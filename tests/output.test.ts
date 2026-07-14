import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  outputError,
  outputJob,
  outputJobList,
  outputJson,
  outputLogs,
  outputModelList,
  outputProgress,
  outputSuccess,
  setHumanMode,
} from "../src/output.js";
import type { JobOut, ModelPublic } from "../src/worker/schemas.js";

const job: JobOut = {
  id: "job_20260714_120000_a1b2c3d4",
  job_alias: "demo",
  job_owner: "liangzhu-lab",
  submitter: null,
  model_id: "esm3",
  idempotency_key: null,
  params: {},
  status: "SUCCEEDED",
  gpu_count: 1,
  input_keys: {},
  output_uri: "jobs/demo/output/result.zip",
  logs_uri: null,
  error: null,
  ray_job_id: null,
  ray_task_ref: null,
  runtime_metadata: {},
  created_at: "2026-07-14T12:00:00Z",
  started_at: "2026-07-14T12:01:00Z",
  finished_at: "2026-07-14T12:05:00Z",
};

const model: ModelPublic = {
  id: "esm3",
  display_name: "ESM-3",
  help_zh: "蛋白质模型",
  enabled: true,
  resources: { gpus: 1, gpus_min: 1, gpus_max: 1, timeout_seconds: 3600 },
  inputs: {
    files: [
      {
        name: "sequence",
        description: "FASTA input",
        help_zh: "输入序列",
        required: true,
        max_size_mb: 10,
      },
    ],
  },
  params: [],
  outputs: { collect: [] },
  limits: null,
};

afterEach(() => setHumanMode(false));

describe("output protocol", () => {
  test("keeps machine output JSON-only and progress on stderr", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWrite = spyOn(process.stdout, "write").mockImplementation(
      (chunk) => {
        stdout.push(String(chunk));
        return true;
      },
    );
    const stderrWrite = spyOn(process.stderr, "write").mockImplementation(
      (chunk) => {
        stderr.push(String(chunk));
        return true;
      },
    );

    try {
      outputJson({ ok: true });
      outputSuccess("not emitted in JSON mode");
      outputLogs({ content: "line\n", url: null });
      outputJob(job);
      outputJobList([job], 1);
      outputModelList([model]);
      outputError("failed", { code: "demo" });
      outputProgress("Polling demo: RUNNING");
    } finally {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
    }

    const documents = stdout.join("").trim().split("\n}\n{").length;
    expect(documents).toBe(5);
    expect(stderr.join("")).toContain('"error":"failed"');
    expect(stderr.join("")).toContain('"progress":"Polling demo: RUNNING"');
  });

  test("renders readable job, model, log, progress, and error output in human mode", () => {
    setHumanMode(true);
    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWrite = spyOn(process.stdout, "write").mockImplementation(
      (chunk) => {
        stdout.push(String(chunk));
        return true;
      },
    );
    const stderrWrite = spyOn(process.stderr, "write").mockImplementation(
      (chunk) => {
        stderr.push(String(chunk));
        return true;
      },
    );

    try {
      outputSuccess("submitted");
      outputError("failed", { code: "demo" });
      outputProgress("Polling demo: RUNNING");
      outputLogs({ content: "without newline", url: null });
      outputLogs({ content: null, url: "http://logs.test/file" });
      outputLogs({ content: null, url: null });
      outputJob(job);
      outputJob({ ...job, status: "QUEUED" });
      outputJob({ ...job, status: "RUNNING" });
      outputJob({ ...job, status: "FAILED", error: "model failed" });
      outputJob({ ...job, status: "CANCELED" });
      outputJobList([], 0);
      outputJobList([job], 1);
      outputModelList([]);
      outputModelList([model]);
    } finally {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
    }

    expect(stdout.join("")).toContain("No logs available.");
    expect(stdout.join("")).toContain("No jobs found.");
    expect(stdout.join("")).toContain("No models available.");
    expect(stdout.join("")).toContain("ESM-3");
    expect(stderr.join("")).toContain("submitted");
    expect(stderr.join("")).toContain("Polling demo: RUNNING");
    expect(stderr.join("")).toContain('"code": "demo"');
  });
});
