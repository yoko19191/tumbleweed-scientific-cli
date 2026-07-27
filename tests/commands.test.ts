import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createProgram, main } from "../src/index.js";

const execFileAsync = promisify(execFile);
const testDirectory = dirname(fileURLToPath(import.meta.url));
const originalWorkerUrl = process.env.TUMBLEWEED_WORKER_URL;

afterEach(() => {
  if (originalWorkerUrl === undefined) delete process.env.TUMBLEWEED_WORKER_URL;
  else process.env.TUMBLEWEED_WORKER_URL = originalWorkerUrl;
});

function modelFixture() {
  return {
    id: "esm3",
    display_name: "ESM-3",
    help_zh: "蛋白质模型",
    enabled: true,
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
    resources: { gpus: 1, gpus_min: 1, gpus_max: 1, timeout_seconds: 3600 },
    inputs: {
      files: [
        {
          name: "sequence",
          description: "FASTA input",
          help_zh: "输入序列",
          required: true,
          max_size_mb: 10,
          example: "sequence_example.fasta",
        },
      ],
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
      {
        name: "sampling_temp",
        type: "str",
        default: "0.1",
        description: "Temperature string",
        help_zh: "采样温度",
      },
    ],
    outputs: { collect: ["/io/output/**"] },
    limits: null,
  };
}

function jobFixture(
  inputKeys: Record<string, string>,
  params: Record<string, unknown>,
) {
  return {
    id: "job_20260714_120000_a1b2c3d4",
    job_alias: null,
    job_owner: "test_owner",
    submitter: null,
    model_id: "esm3",
    idempotency_key: null,
    params,
    status: "QUEUED",
    gpu_count: 1,
    input_keys: inputKeys,
    output_uri: null,
    logs_uri: null,
    error: null,
    ray_job_id: null,
    ray_task_ref: null,
    runtime_metadata: {},
    created_at: "2026-07-14T12:00:00Z",
    started_at: null,
    finished_at: null,
  };
}

describe("command surface", () => {
  test("exposes the supported Worker job command surface", () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toEqual(["jobs"]);

    const jobs = program.commands[0];
    expect(jobs?.commands.map((command) => command.name())).toEqual([
      "models",
      "example",
      "submit",
      "list",
      "show",
      "result",
      "logs",
      "cancel",
      "wait",
      "health",
      "config",
    ]);
  });

  test("downloads a declared model input example to an explicit path", async () => {
    const requests: string[] = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = new URL(String(input));
        requests.push(url.pathname);
        return new Response(">demo\nMSTN\n", {
          headers: { "Content-Type": "text/plain" },
        });
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050/";
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-example-"));
    const outputPath = join(directory, "examples", "sequence.fasta");
    const stdout: string[] = [];
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });

    try {
      await createProgram()
        .exitOverride()
        .parseAsync([
          "node",
          "tumbleweed",
          "jobs",
          "example",
          "esm3",
          "sequence",
          "--output",
          outputPath,
        ]);

      expect(requests).toEqual(["/models/esm3/examples/sequence"]);
      expect(readFileSync(outputPath, "utf-8")).toBe(">demo\nMSTN\n");
      expect(JSON.parse(stdout.join(""))).toEqual({
        model_id: "esm3",
        input_name: "sequence",
        path: outputPath,
        bytes: 11,
      });
    } finally {
      write.mockRestore();
      fetchMock.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("submit discovers the model, uploads local inputs, and preserves schema types", async () => {
    const requests: Array<{ method: string; path: string; body: unknown }> = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const rawBody = typeof init?.body === "string" ? init.body : null;
        requests.push({
          method,
          path: url.pathname,
          body: rawBody ? JSON.parse(rawBody) : null,
        });

        if (url.pathname === "/models") {
          return Response.json({ items: [modelFixture()] });
        }
        if (url.pathname === "/uploads/presign") {
          return Response.json({
            method: "PUT",
            url: "http://upload.test/objects/sequence.fa",
            object_key:
              "jobs/job_20260714_120000_a1b2c3d4/input/sequence/sequence.fa",
            max_size_mb: 10,
            expires_seconds: 900,
          });
        }
        if (url.pathname === "/objects/sequence.fa") {
          return new Response(null, { status: 200 });
        }
        if (url.pathname === "/jobs") {
          const payload = JSON.parse(String(rawBody));
          return Response.json(jobFixture(payload.input_keys, payload.params));
        }
        return new Response("not found", { status: 404 });
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050/";

    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-cli-"));
    const inputPath = join(directory, "sequence.fa");
    writeFileSync(inputPath, ">demo\nMSTN\n");
    const stdout: string[] = [];
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });

    try {
      const program = createProgram().exitOverride();
      await program.parseAsync([
        "node",
        "tumbleweed",
        "jobs",
        "submit",
        "--model",
        "esm3",
        "--input",
        `sequence=${inputPath}`,
        "--param",
        "task=fold",
        "sampling_temp=0.1",
      ]);
    } finally {
      write.mockRestore();
      fetchMock.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }

    const submitted = requests.find(
      (request) => request.method === "POST" && request.path === "/jobs",
    );
    expect(submitted?.body).toMatchObject({
      model_id: "esm3",
      input_keys: {
        sequence:
          "jobs/job_20260714_120000_a1b2c3d4/input/sequence/sequence.fa",
      },
      params: { task: "fold", sampling_temp: "0.1" },
    });
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "GET /models",
      "POST /uploads/presign",
      "PUT /objects/sequence.fa",
      "POST /jobs",
    ]);
    expect(JSON.parse(stdout.join(""))).toMatchObject({
      model_id: "esm3",
      status: "QUEUED",
    });
  });

  test("jobs config persists Worker settings without exposing a top-level config command", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-cli-config-"));
    const configPath = join(directory, "config.json");
    const stdout: string[] = [];
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });

    try {
      await createProgram({ configPath })
        .exitOverride()
        .parseAsync([
          "node",
          "tumbleweed",
          "jobs",
          "config",
          "set",
          "worker_url",
          "http://saved.example:9050/",
        ]);
      expect(JSON.parse(stdout.join(""))).toMatchObject({
        worker_url: "http://saved.example:9050",
      });

      stdout.length = 0;
      await createProgram({ configPath })
        .exitOverride()
        .parseAsync(["node", "tumbleweed", "jobs", "config", "show"]);
      expect(JSON.parse(stdout.join(""))).toMatchObject({
        config_path: configPath,
        values: {
          worker_url: {
            value: "http://saved.example:9050",
            source: configPath,
          },
        },
      });

      stdout.length = 0;
      await createProgram({ configPath })
        .exitOverride()
        .parseAsync(["node", "tumbleweed", "jobs", "config", "path"]);
      expect(JSON.parse(stdout.join(""))).toEqual({ path: configPath });

      await expect(
        createProgram({ configPath })
          .exitOverride()
          .parseAsync([
            "node",
            "tumbleweed",
            "jobs",
            "config",
            "set",
            "api_url",
            "http://legacy.invalid",
          ]),
      ).rejects.toThrow("Unknown config key: api_url");
    } finally {
      write.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("supports the complete remote job lifecycle from the jobs namespace", async () => {
    const requests: string[] = [];
    const completedJob = {
      ...jobFixture(
        { sequence: "jobs/demo/input/sequence.fa" },
        { task: "fold" },
      ),
      status: "SUCCEEDED",
      output_uri: "jobs/demo/output/result.zip",
      logs_uri: "jobs/demo/logs/execution.log",
      finished_at: "2026-07-14T12:05:00Z",
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        requests.push(`${method} ${url.pathname}${url.search}`);

        if (url.pathname === "/models")
          return Response.json({ items: [modelFixture()] });
        if (url.pathname === "/jobs" && method === "GET") {
          return Response.json({
            items: [completedJob],
            total: 1,
            limit: 50,
            offset: 0,
          });
        }
        if (url.pathname.endsWith("/result")) {
          return Response.json({
            url: "http://download.test/result.zip",
            object_key: "jobs/demo/output/result.zip",
            expires_seconds: 900,
          });
        }
        if (url.pathname.endsWith("/logs")) {
          return Response.json({ content: "model finished\n", url: null });
        }
        if (
          url.pathname.startsWith("/jobs/") &&
          (method === "GET" || method === "DELETE")
        ) {
          return Response.json(completedJob);
        }
        if (url.pathname === "/healthz") return Response.json({ status: "ok" });
        if (url.pathname === "/readyz") {
          return Response.json({
            status: "ok",
            checks: {
              registry: "ok",
              database: "ok",
              storage: "ok",
              ray: "ok",
            },
            resources: { gpus_total: 8, gpus_available: 3 },
          });
        }
        return new Response("not found", { status: 404 });
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050/";
    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        stderr.push(String(chunk));
        return true;
      });
    const run = async (...args: string[]) => {
      stdout.length = 0;
      await createProgram()
        .exitOverride()
        .parseAsync(["node", "tumbleweed", "jobs", ...args]);
      return stdout.join("");
    };

    try {
      expect(JSON.parse(await run("models"))).toMatchObject({
        items: [{ id: "esm3" }],
      });
      expect(JSON.parse(await run("models", "esm3"))).toMatchObject({
        id: "esm3",
        card: {
          category: "蛋白质设计",
          use_cases: ["蛋白质设计"],
          limitations: ["大模型需要较多显存"],
          links: { repo: "https://github.com/evolutionaryscale/esm" },
        },
        inputs: {
          files: [{ name: "sequence", example: "sequence_example.fasta" }],
        },
      });
      expect(JSON.parse(await run("list"))).toMatchObject({ total: 1 });
      expect(JSON.parse(await run("show", completedJob.id))).toMatchObject({
        status: "SUCCEEDED",
      });
      expect(JSON.parse(await run("result", completedJob.id))).toMatchObject({
        object_key: "jobs/demo/output/result.zip",
      });
      expect(JSON.parse(await run("logs", completedJob.id))).toEqual({
        content: "model finished\n",
        url: null,
      });
      expect(JSON.parse(await run("cancel", completedJob.id))).toMatchObject({
        status: "SUCCEEDED",
      });
      expect(
        JSON.parse(await run("wait", completedJob.id, "--interval", "0")),
      ).toMatchObject({
        status: "SUCCEEDED",
      });
      expect(JSON.parse(await run("health"))).toEqual({
        worker_url: "http://worker.test:9050",
        health: { status: "ok" },
        ready: {
          status: "ok",
          checks: {
            registry: "ok",
            database: "ok",
            storage: "ok",
            ray: "ok",
          },
          resources: { gpus_total: 8, gpus_available: 3 },
        },
      });
      expect(stderr.join("")).toContain('"progress":"Polling');
    } finally {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
      fetchMock.mockRestore();
    }

    expect(requests).toContain("DELETE /jobs/job_20260714_120000_a1b2c3d4");
    expect(requests).toContain("GET /readyz");
  });

  test("main returns a success exit code instead of terminating the process", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/healthz") return Response.json({ status: "ok" });
        return Response.json({ status: "ok", checks: {} });
      });
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";
    try {
      expect(await main(["node", "tumbleweed", "jobs", "health"])).toBe(0);
    } finally {
      stdoutWrite.mockRestore();
      fetchMock.mockRestore();
    }
  });

  test("main maps Worker, infrastructure, and command validation failures to stable exit codes", async () => {
    let response = new Response();
    let fetchError: Error | undefined;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        if (fetchError) throw fetchError;
        return response;
      });
    const stderr: string[] = [];
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        stderr.push(String(chunk));
        return true;
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";

    try {
      response = Response.json(
        {
          error: {
            code: "unknown_model",
            message: "model missing",
            detail: {},
          },
        },
        { status: 404 },
      );
      expect(await main(["node", "tumbleweed", "jobs", "models"])).toBe(1);

      response = Response.json(
        {
          error: {
            code: "storage_error",
            message: "storage unavailable",
            detail: {},
          },
        },
        { status: 503 },
      );
      expect(await main(["node", "tumbleweed", "jobs", "models"])).toBe(2);

      response = Response.json({ items: [] });
      expect(
        await main(["node", "tumbleweed", "jobs", "models", "missing"]),
      ).toBe(1);

      response = Response.json({ items: [{ invalid: true }] });
      expect(await main(["node", "tumbleweed", "jobs", "models"])).toBe(2);

      fetchError = new DOMException("The operation timed out", "TimeoutError");
      expect(await main(["node", "tumbleweed", "jobs", "models"])).toBe(2);
      expect(stderr.join("")).toContain('"code":"unknown_model"');
      expect(stderr.join("")).toContain('"code":"timeout"');
    } finally {
      stderrWrite.mockRestore();
      fetchMock.mockRestore();
    }
  });

  test("health preserves readiness details when the Worker is degraded", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/healthz") return Response.json({ status: "ok" });
        return Response.json(
          {
            status: "error",
            checks: { registry: "ok", database: "offline", storage: "ok" },
          },
          { status: 503 },
        );
      });
    const stderr: string[] = [];
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        stderr.push(String(chunk));
        return true;
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";
    try {
      expect(await main(["node", "tumbleweed", "jobs", "health"])).toBe(1);
      expect(stderr.join("")).toContain('"database":"offline"');
    } finally {
      stderrWrite.mockRestore();
      fetchMock.mockRestore();
    }
  });

  test("wait returns a business failure when the remote job does not succeed", async () => {
    const failedJob = {
      ...jobFixture({}, {}),
      status: "FAILED",
      error: "model crashed",
      finished_at: "2026-07-14T12:05:00Z",
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(failedJob));
    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        stderr.push(String(chunk));
        return true;
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";

    try {
      expect(
        await main([
          "node",
          "tumbleweed",
          "jobs",
          "wait",
          failedJob.id,
          "--interval",
          "0",
        ]),
      ).toBe(1);
      expect(JSON.parse(stdout.join(""))).toMatchObject({
        status: "FAILED",
        error: "model crashed",
      });
      expect(stderr.join("")).toContain('"code":"job_failed"');
    } finally {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
      fetchMock.mockRestore();
    }
  });

  test("human mode changes config output presentation without changing data", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-cli-config-"));
    const configPath = join(directory, "config.json");
    const stdout: string[] = [];
    const stderr: string[] = [];
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        stderr.push(String(chunk));
        return true;
      });

    try {
      await createProgram({ configPath })
        .exitOverride()
        .parseAsync([
          "node",
          "tumbleweed",
          "--human",
          "jobs",
          "config",
          "set",
          "worker_url",
          "http://saved.example:9050/",
        ]);
      expect(stderr.join("")).toContain("Set worker_url");
      expect(stdout.join("")).toContain(
        '"worker_url": "http://saved.example:9050"',
      );

      stdout.length = 0;
      stderr.length = 0;
      await createProgram({ configPath })
        .exitOverride()
        .parseAsync([
          "node",
          "tumbleweed",
          "--human",
          "jobs",
          "config",
          "show",
        ]);
      expect(stdout.join("")).toContain("Config path");
      expect(stdout.join("")).toContain("worker_url");
      expect(stdout.join("")).toContain("http://saved.example:9050");

      stdout.length = 0;
      await createProgram({ configPath })
        .exitOverride()
        .parseAsync([
          "node",
          "tumbleweed",
          "--human",
          "jobs",
          "config",
          "path",
        ]);
      expect(stdout.join("").trim()).toBe(configPath);
    } finally {
      write.mockRestore();
      stderrWrite.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("human mode renders health and model detail as readable text", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/models")
          return Response.json({ items: [modelFixture()] });
        if (path === "/healthz") return Response.json({ status: "ok" });
        return Response.json({
          status: "ok",
          checks: { registry: "ok", database: "ok", storage: "ok" },
          resources: { gpus_total: 8, gpus_available: 3 },
        });
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";
    const stdout: string[] = [];
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });

    try {
      await createProgram()
        .exitOverride()
        .parseAsync(["node", "tumbleweed", "--human", "jobs", "health"]);
      expect(stdout.join("")).toContain("Worker URL");
      expect(stdout.join("")).toContain("healthy / ready");
      expect(stdout.join("")).toContain("3 / 8 available");

      stdout.length = 0;
      await createProgram()
        .exitOverride()
        .parseAsync([
          "node",
          "tumbleweed",
          "--human",
          "jobs",
          "models",
          "esm3",
        ]);
      expect(stdout.join("")).toContain("ESM-3");
      expect(stdout.join("")).toContain("sequence");
    } finally {
      stdoutWrite.mockRestore();
      fetchMock.mockRestore();
    }
  });

  test("submit rejects invalid dynamic inputs and parameters before creating a job", async () => {
    const validationModel = {
      ...modelFixture(),
      params: [
        ...modelFixture().params,
        {
          name: "count",
          type: "int",
          default: 1,
          min: 1,
          max: 3,
          description: "Count",
          help_zh: "数量",
        },
        {
          name: "ratio",
          type: "float",
          default: 0.5,
          min: 0,
          max: 1,
          description: "Ratio",
          help_zh: "比例",
        },
        {
          name: "save",
          type: "bool",
          default: false,
          description: "Save",
          help_zh: "保存",
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ items: [validationModel] }),
      );
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";
    const base = ["node", "tumbleweed", "jobs", "submit", "--model", "esm3"];
    const cases: Array<{ args: string[]; message: string }> = [
      { args: [], message: "Missing required input" },
      { args: ["--input", "invalid"], message: "Invalid key=value pair" },
      {
        args: ["--input", "sequence=a", "sequence=b"],
        message: "Duplicate key",
      },
      {
        args: ["--input-key", "unknown=jobs/input.fa"],
        message: "Unknown input",
      },
      {
        args: [
          "--input",
          "sequence=missing.fa",
          "--input-key",
          "sequence=jobs/input.fa",
        ],
        message: "both a local file and an object key",
      },
      {
        args: [
          "--input-key",
          "sequence=jobs/input.fa",
          "--param",
          "unknown=value",
        ],
        message: "Unknown parameter",
      },
      {
        args: [
          "--input-key",
          "sequence=jobs/input.fa",
          "--param",
          "task=invalid",
        ],
        message: "must be one of",
      },
      {
        args: ["--input-key", "sequence=jobs/input.fa", "--param", "save=yes"],
        message: "must be true or false",
      },
      {
        args: ["--input-key", "sequence=jobs/input.fa", "--param", "count=1.5"],
        message: "must be an integer",
      },
      {
        args: [
          "--input-key",
          "sequence=jobs/input.fa",
          "--param",
          "ratio=not-a-number",
        ],
        message: "must be a number",
      },
      {
        args: ["--input-key", "sequence=jobs/input.fa", "--param", "count=0"],
        message: "greater than or equal",
      },
      {
        args: ["--input-key", "sequence=jobs/input.fa", "--param", "count=4"],
        message: "less than or equal",
      },
      {
        args: ["--input", "sequence=/definitely/missing.fa"],
        message: "Input file not found",
      },
    ];

    try {
      for (const item of cases) {
        await expect(
          createProgram()
            .exitOverride()
            .parseAsync([...base, ...item.args]),
        ).rejects.toThrow(item.message);
      }
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("result downloads an artifact and reports transfer failures", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-result-"));
    let downloadStatus = 200;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/result")) {
          return Response.json({
            url: "http://download.test/artifact.zip",
            object_key: "jobs/demo/output/artifact.zip",
            expires_seconds: 900,
          });
        }
        return new Response("archive", { status: downloadStatus });
      });
    process.env.TUMBLEWEED_WORKER_URL = "http://worker.test:9050";
    const stdout: string[] = [];
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
      });
    const args = [
      "node",
      "tumbleweed",
      "jobs",
      "result",
      "job_20260714_120000_a1b2c3d4",
      "--output-dir",
      directory,
    ];

    try {
      await createProgram().exitOverride().parseAsync(args);
      const output = JSON.parse(stdout.join(""));
      expect(output.path).toBe(join(directory, "artifact.zip"));
      expect(readFileSync(output.path, "utf-8")).toBe("archive");

      downloadStatus = 502;
      await expect(
        createProgram().exitOverride().parseAsync(args),
      ).rejects.toThrow("Download failed: HTTP 502");
    } finally {
      stdoutWrite.mockRestore();
      fetchMock.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("executable waits for a delayed artifact download before exiting", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-large-result-"));

    try {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--import",
          join(testDirectory, "fixtures/delayed-fetch.mjs"),
          join(testDirectory, "../src/bin.ts"),
          "jobs",
          "result",
          "job_20260714_120000_a1b2c3d4",
          "--output-dir",
          directory,
        ],
        {
          env: {
            ...process.env,
            TUMBLEWEED_WORKER_URL: "http://worker.test:9050",
          },
          maxBuffer: 4 * 1024 * 1024,
        },
      );

      expect(stderr).toBe("");
      const receipt = JSON.parse(stdout);
      expect(receipt.path).toBe(join(directory, "artifact.bin"));
      const downloaded = readFileSync(receipt.path);
      expect(downloaded.byteLength).toBe(2 * 1024 * 1024);
      expect(downloaded[0]).toBe(7);
      expect(downloaded.at(-1)).toBe(7);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
