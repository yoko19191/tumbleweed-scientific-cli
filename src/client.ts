import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig } from "./config.js";
import {
  ApiErrorSchema,
  JobListOutSchema,
  JobOutSchema,
  LogsOutSchema,
  ModelListOutSchema,
  PresignedGetOutSchema,
  PresignUploadOutSchema,
  type CreateJobRequest,
  type JobListOut,
  type JobOut,
  type LogsOut,
  type ModelListOut,
  type PresignUploadOut,
  type PresignedGetOut,
} from "./types.js";

// ---------------------------------------------------------------------------
// API client error
// ---------------------------------------------------------------------------
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function apiUrl(path: string): string {
  const config = loadConfig();
  const base = config.api_url.replace(/\/+$/, "");
  return `${base}${path}`;
}

async function handleResponse<T>(
  response: Response,
  parse: (data: unknown) => T,
): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiClientError(
        parsed.data.error.message,
        response.status,
        parsed.data.error.code,
        parsed.data.error.detail as Record<string, unknown>,
      );
    }
    throw new ApiClientError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      "http_error",
    );
  }

  return parse(body);
}

async function get<T>(path: string, parse: (d: unknown) => T): Promise<T> {
  const response = await fetch(apiUrl(path));
  return handleResponse(response, parse);
}

async function post<T>(
  path: string,
  body: unknown,
  parse: (d: unknown) => T,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(response, parse);
}

async function del<T>(path: string, parse: (d: unknown) => T): Promise<T> {
  const response = await fetch(apiUrl(path), { method: "DELETE" });
  return handleResponse(response, parse);
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export async function listModels(): Promise<ModelListOut> {
  return get("/models", (d) => ModelListOutSchema.parse(d));
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export async function presignUpload(opts: {
  modelId: string;
  inputName: string;
  filename: string;
  contentType?: string;
  jobId?: string;
  sizeBytes?: number;
}): Promise<PresignUploadOut> {
  return post(
    "/uploads/presign",
    {
      model_id: opts.modelId,
      input_name: opts.inputName,
      filename: opts.filename,
      content_type: opts.contentType,
      job_id: opts.jobId,
      size_bytes: opts.sizeBytes,
    },
    (d) => PresignUploadOutSchema.parse(d),
  );
}

/**
 * Upload a local file via presigned PUT URL.
 * Returns the object key stored in MinIO.
 */
export async function uploadFile(opts: {
  modelId: string;
  inputName: string;
  filePath: string;
  jobId?: string;
}): Promise<{ objectKey: string }> {
  const stat = statSync(opts.filePath);
  const filename = basename(opts.filePath);

  // 1. Get presigned URL
  const presign = await presignUpload({
    modelId: opts.modelId,
    inputName: opts.inputName,
    filename,
    jobId: opts.jobId,
    sizeBytes: stat.size,
  });

  // 2. PUT file content
  const fileContent = readFileSync(opts.filePath);
  const putResponse = await fetch(presign.url, {
    method: "PUT",
    body: fileContent,
  });

  if (!putResponse.ok) {
    throw new ApiClientError(
      `Upload failed: HTTP ${putResponse.status}`,
      putResponse.status,
      "upload_failed",
    );
  }

  return { objectKey: presign.object_key };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function createJob(request: CreateJobRequest): Promise<JobOut> {
  return post("/jobs", request, (d) => JobOutSchema.parse(d));
}

export async function listJobs(opts?: {
  jobOwner?: string;
  limit?: number;
  offset?: number;
}): Promise<JobListOut> {
  const params = new URLSearchParams();
  if (opts?.jobOwner) params.set("job_owner", opts.jobOwner);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return get(`/jobs${qs ? `?${qs}` : ""}`, (d) => JobListOutSchema.parse(d));
}

export async function getJob(jobId: string): Promise<JobOut> {
  return get(`/jobs/${encodeURIComponent(jobId)}`, (d) =>
    JobOutSchema.parse(d),
  );
}

export async function getJobResult(jobId: string): Promise<PresignedGetOut> {
  return get(`/jobs/${encodeURIComponent(jobId)}/result`, (d) =>
    PresignedGetOutSchema.parse(d),
  );
}

export async function getJobLogs(jobId: string): Promise<LogsOut> {
  return get(`/jobs/${encodeURIComponent(jobId)}/logs`, (d) =>
    LogsOutSchema.parse(d),
  );
}

export async function cancelJob(jobId: string): Promise<JobOut> {
  return del(`/jobs/${encodeURIComponent(jobId)}`, (d) =>
    JobOutSchema.parse(d),
  );
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function healthz(): Promise<{ status: string }> {
  return get("/healthz", (d) => d as { status: string });
}

export async function readyz(): Promise<{
  status: string;
  checks: Record<string, string>;
}> {
  return get("/readyz", (d) => d as { status: string; checks: Record<string, string> });
}

// ---------------------------------------------------------------------------
// Polling helper
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);

export async function waitForJob(
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number; onPoll?: (job: JobOut) => void },
): Promise<JobOut> {
  const interval = opts?.intervalMs ?? 5000;
  const timeout = opts?.timeoutMs ?? 600_000;
  const start = Date.now();

  while (true) {
    const job = await getJob(jobId);
    opts?.onPoll?.(job);

    if (TERMINAL_STATUSES.has(job.status)) {
      return job;
    }

    if (Date.now() - start > timeout) {
      throw new ApiClientError(
        `Timed out waiting for job ${jobId} after ${timeout / 1000}s`,
        0,
        "timeout",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
