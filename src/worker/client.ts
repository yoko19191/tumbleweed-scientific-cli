import { basename } from "node:path";
import { loadConfig } from "../config.js";
import { CliError } from "../errors.js";
import {
  ApiErrorSchema,
  type CreateJobRequest,
  HealthOutSchema,
  type JobListOut,
  JobListOutSchema,
  type JobOut,
  JobOutSchema,
  type LogsOut,
  LogsOutSchema,
  type ModelListOut,
  ModelListOutSchema,
  type PresignedGetOut,
  PresignedGetOutSchema,
  type PresignUploadOut,
  PresignUploadOutSchema,
  type ReadyOut,
  ReadyOutSchema,
} from "./schemas.js";

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

const WORKER_REQUEST_TIMEOUT_MS = 30_000;

function apiUrl(path: string): string {
  const config = loadConfig();
  const base = config.worker_url;
  return `${base}${path}`;
}

async function handleResponse<T>(
  response: Response,
  parse: (data: unknown) => T,
  acceptedStatuses: readonly number[] = [],
): Promise<T> {
  const body = await response.json();

  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw apiClientError(response, body);
  }

  return parse(body);
}

function apiClientError(response: Response, body: unknown): ApiClientError {
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success) {
    return new ApiClientError(
      parsed.data.error.message,
      response.status,
      parsed.data.error.code,
      parsed.data.error.detail as Record<string, unknown>,
    );
  }
  return new ApiClientError(
    `HTTP ${response.status}: ${response.statusText}`,
    response.status,
    "http_error",
  );
}

async function workerFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(apiUrl(path), {
      ...init,
      signal: AbortSignal.timeout(WORKER_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiClientError(
        "Worker request timed out after 30 seconds",
        0,
        "timeout",
        { timeout_seconds: WORKER_REQUEST_TIMEOUT_MS / 1000 },
      );
    }
    throw error;
  }
}

async function get<T>(
  path: string,
  parse: (d: unknown) => T,
  acceptedStatuses?: readonly number[],
): Promise<T> {
  const response = await workerFetch(path);
  return handleResponse(response, parse, acceptedStatuses);
}

async function post<T>(
  path: string,
  body: unknown,
  parse: (d: unknown) => T,
): Promise<T> {
  const response = await workerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(response, parse);
}

async function del<T>(path: string, parse: (d: unknown) => T): Promise<T> {
  const response = await workerFetch(path, { method: "DELETE" });
  return handleResponse(response, parse);
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export async function listModels(): Promise<ModelListOut> {
  return get("/models", (d) => ModelListOutSchema.parse(d));
}

export async function getModelExample(
  modelId: string,
  inputName: string,
): Promise<ArrayBuffer> {
  const response = await workerFetch(
    `/models/${encodeURIComponent(modelId)}/examples/${encodeURIComponent(inputName)}`,
  );
  if (!response.ok) {
    throw apiClientError(response, await response.json());
  }
  return response.arrayBuffer();
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
  const file = Bun.file(opts.filePath);
  if (!(await file.exists())) {
    throw new CliError(
      `Input file not found: ${opts.filePath}`,
      "input_file_not_found",
    );
  }
  const filename = basename(opts.filePath);

  // 1. Get presigned URL
  const presign = await presignUpload({
    modelId: opts.modelId,
    inputName: opts.inputName,
    filename,
    contentType: file.type || "application/octet-stream",
    jobId: opts.jobId,
    sizeBytes: file.size,
  });

  const putResponse = await fetch(presign.url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
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
  return get("/healthz", (d) => HealthOutSchema.parse(d));
}

export async function readyz(): Promise<ReadyOut> {
  return get("/readyz", (d) => ReadyOutSchema.parse(d), [503]);
}

// ---------------------------------------------------------------------------
// Polling helper
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);

export async function waitForJob(
  jobId: string,
  opts?: {
    intervalMs?: number;
    timeoutMs?: number;
    onPoll?: (job: JobOut) => void;
  },
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
