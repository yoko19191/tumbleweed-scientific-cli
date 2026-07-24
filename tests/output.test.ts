import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  outputConfigPath,
  outputConfigShow,
  outputError,
  outputHealth,
  outputJob,
  outputJobList,
  outputJson,
  outputLogs,
  outputModelDetail,
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

  test("renders config, health, and model detail as JSON by default", () => {
    const stdout: string[] = [];
    const stdoutWrite = spyOn(process.stdout, "write").mockImplementation(
      (chunk) => {
        stdout.push(String(chunk));
        return true;
      },
    );

    try {
      outputConfigPath("/tmp/config.json");
      outputConfigShow("/tmp/config.json", {
        worker_url: { value: "http://worker.test", source: "env" },
      });
      outputHealth(
        "http://worker.test",
        { status: "ok" },
        {
          status: "ok",
          checks: { registry: "ok" },
          resources: { gpus_total: 8, gpus_available: 3 },
        },
      );
      outputModelDetail(model);
    } finally {
      stdoutWrite.mockRestore();
    }

    const output = stdout.join("");
    expect(output).toContain('"path": "/tmp/config.json"');
    expect(output).toContain('"config_path": "/tmp/config.json"');
    expect(output).toContain('"worker_url": "http://worker.test"');
    expect(output).toContain('"status": "ok"');
    expect(output).toContain('"id": "esm3"');
  });

  test("renders config, health, and model detail in human mode", () => {
    setHumanMode(true);
    const stdout: string[] = [];
    const stdoutWrite = spyOn(process.stdout, "write").mockImplementation(
      (chunk) => {
        stdout.push(String(chunk));
        return true;
      },
    );

    const detailedModel: ModelPublic = {
      ...model,
      card: {
        summary_zh: "生成并理解蛋白质序列与结构。",
        category: "蛋白质设计",
        tags: ["序列", "结构"],
        input_modalities: ["FASTA"],
        output_modalities: ["PDB"],
        features: ["结构预测"],
        use_cases: ["蛋白质设计"],
        limitations: ["大模型需要较多显存"],
        links: { repo: "https://github.com/evolutionaryscale/esm" },
      },
      params: [
        {
          name: "task",
          type: "enum",
          default: "fold",
          choices: ["fold", "embed"],
          description: "Task",
          help_zh: "任务类型",
        },
      ],
    };

    try {
      outputConfigPath("/tmp/config.json");
      outputConfigShow("/tmp/config.json", {
        worker_url: { value: "http://worker.test", source: "env" },
        job_owner: { value: "(not set)", source: "default" },
      });
      outputHealth(
        "http://worker.test",
        { status: "ok" },
        {
          status: "ok",
          checks: { registry: "ok", database: "ok" },
          resources: { gpus_total: 8, gpus_available: 3 },
        },
      );
      outputModelDetail(detailedModel);
    } finally {
      stdoutWrite.mockRestore();
    }

    const output = stdout.join("");
    expect(output).toContain("/tmp/config.json");
    expect(output).toContain("worker_url");
    expect(output).toContain("Worker URL");
    expect(output).toContain("healthy / ready");
    expect(output).toContain("registry");
    expect(output).toContain("3 / 8 available");
    expect(output).toContain("ESM-3");
    expect(output).toContain("蛋白质设计");
    expect(output).toContain("task");
    expect(output).toContain("repo:");
  });
});
