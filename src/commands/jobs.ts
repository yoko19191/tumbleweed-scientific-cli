import { randomBytes } from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Command } from "commander";
import { loadConfig } from "../config.js";
import { CliError } from "../errors.js";
import {
  outputHealth,
  outputJob,
  outputJobList,
  outputJson,
  outputLogs,
  outputModelDetail,
  outputModelList,
  outputProgress,
  outputSuccess,
} from "../output.js";
import {
  cancelJob,
  createJob,
  getJob,
  getJobLogs,
  getJobResult,
  getModelExample,
  healthz,
  listJobs,
  listModels,
  readyz,
  uploadFile,
  waitForJob,
} from "../worker/client.js";
import type { ModelPublic, ParamSpec } from "../worker/schemas.js";
import { registerConfigCommand } from "./config.js";

export function registerJobsCommand(
  program: Command,
  options: { configPath?: string } = {},
): void {
  const jobs = program
    .command("jobs")
    .description("Manage jobs on a remote Tumbleweed Scientific Worker");

  jobs
    .command("models")
    .description("Discover models from the Worker registry")
    .argument("[model_id]", "Show one model in detail")
    .action(async (modelId?: string) => {
      const result = await listModels();
      if (modelId) {
        const model = result.items.find((item) => item.id === modelId);
        if (!model)
          throw new CliError(`Unknown model: ${modelId}`, "unknown_model");
        outputModelDetail(model);
        return;
      }
      outputModelList(result.items);
    });

  jobs
    .command("example")
    .description("Download a model input example")
    .argument("<model_id>", "Model ID")
    .argument("<input_name>", "Model input name")
    .requiredOption("--output <path>", "Write the example to this path")
    .action(
      async (modelId: string, inputName: string, opts: { output: string }) => {
        const data = await getModelExample(modelId, inputName);
        mkdirSync(dirname(opts.output), { recursive: true });
        await writeFile(opts.output, new Uint8Array(data));
        outputJson({
          model_id: modelId,
          input_name: inputName,
          path: opts.output,
          bytes: data.byteLength,
        });
      },
    );

  // ── submit ────────────────────────────────────────────────────────────
  jobs
    .command("submit")
    .description("Submit a new inference job")
    .requiredOption("--model <id>", "Model ID")
    .option(
      "--input <entries...>",
      "Local input files as name=path pairs; files are uploaded before submission",
    )
    .option(
      "--input-key <entries...>",
      "Input object keys as name=key pairs (e.g. input=jobs/xxx/input/input/seq.fa)",
    )
    .option(
      "--param <entries...>",
      "Model parameters as name=value pairs (e.g. num_recycles=3)",
    )
    .option("--job-id <id>", "Specify a job ID (optional)")
    .option("--job-alias <alias>", "Human-readable alias for the job")
    .option("--gpu-count <n>", "Override GPU count", parseInt)
    .option(
      "--idempotency-key <key>",
      "Idempotency key to prevent duplicate submissions",
    )
    .action(
      async (opts: {
        model: string;
        input?: string[];
        inputKey?: string[];
        param?: string[];
        jobId?: string;
        jobAlias?: string;
        gpuCount?: number;
        idempotencyKey?: string;
      }) => {
        const config = loadConfig(options);
        const models = await listModels();
        const model = models.items.find((item) => item.id === opts.model);
        if (!model)
          throw new CliError(`Unknown model: ${opts.model}`, "unknown_model");

        const localInputs = parseKvPairs(opts.input ?? []);
        const inputKeys = parseKvPairs(opts.inputKey ?? []);
        validateInputs(model, localInputs, inputKeys);
        const params = parseModelParams(model.params, opts.param ?? []);
        const jobId = opts.jobId ?? generateJobId();

        for (const [inputName, filePath] of Object.entries(localInputs)) {
          const uploaded = await uploadFile({
            modelId: model.id,
            inputName,
            filePath,
            jobId,
          });
          inputKeys[inputName] = uploaded.objectKey;
        }

        const job = await createJob({
          model_id: opts.model,
          input_keys: inputKeys,
          params,
          job_id: jobId,
          job_alias: opts.jobAlias,
          job_owner: config.job_owner,
          gpu_count: opts.gpuCount,
          idempotency_key: opts.idempotencyKey,
        });

        outputSuccess(`Job submitted: ${job.id}`);
        outputJob(job);
      },
    );

  // ── list ──────────────────────────────────────────────────────────────
  jobs
    .command("list")
    .description("List jobs with pagination")
    .option("--owner <owner>", "Filter by job owner")
    .option("--limit <n>", "Max items to return", parseInt, 50)
    .option("--offset <n>", "Pagination offset", parseInt, 0)
    .action(async (opts: { owner?: string; limit: number; offset: number }) => {
      const config = loadConfig(options);
      const result = await listJobs({
        jobOwner: opts.owner ?? config.job_owner,
        limit: opts.limit,
        offset: opts.offset,
      });
      outputJobList(result.items, result.total);
    });

  // ── status ────────────────────────────────────────────────────────────
  jobs
    .command("show")
    .description("Show job status and details")
    .argument("<job_id>", "Job ID")
    .action(async (jobId: string) => {
      const job = await getJob(jobId);
      outputJob(job);
    });

  // ── result ────────────────────────────────────────────────────────────
  jobs
    .command("result")
    .description("Get result download URL (or download to local dir)")
    .argument("<job_id>", "Job ID")
    .option("--output-dir <dir>", "Download result to this directory")
    .action(async (jobId: string, opts: { outputDir?: string }) => {
      const result = await getJobResult(jobId);

      if (opts.outputDir) {
        mkdirSync(opts.outputDir, { recursive: true });
        const response = await fetch(result.url);
        if (!response.ok) {
          throw new CliError(
            `Download failed: HTTP ${response.status}`,
            "download_failed",
          );
        }
        const filename = result.object_key.split("/").pop() ?? "result";
        const outPath = join(opts.outputDir, filename);
        await writeResponseToFile(response, outPath);
        outputSuccess(`Downloaded → ${outPath}`);
        outputJson({ path: outPath, object_key: result.object_key });
      } else {
        outputJson(result);
      }
    });

  // ── logs ──────────────────────────────────────────────────────────────
  jobs
    .command("logs")
    .description("Get job execution logs")
    .argument("<job_id>", "Job ID")
    .action(async (jobId: string) => {
      const logs = await getJobLogs(jobId);
      outputLogs(logs);
    });

  // ── cancel ────────────────────────────────────────────────────────────
  jobs
    .command("cancel")
    .description("Cancel a queued or running job")
    .argument("<job_id>", "Job ID")
    .action(async (jobId: string) => {
      const job = await cancelJob(jobId);
      outputSuccess(`Job ${jobId} → ${job.status}`);
      outputJob(job);
    });

  // ── wait ──────────────────────────────────────────────────────────────
  jobs
    .command("wait")
    .description("Poll until job reaches a terminal state (Agent-friendly)")
    .argument("<job_id>", "Job ID")
    .option("--interval <seconds>", "Polling interval in seconds", parseInt, 5)
    .option(
      "--timeout <seconds>",
      "Maximum wait time in seconds",
      parseInt,
      600,
    )
    .action(
      async (jobId: string, opts: { interval: number; timeout: number }) => {
        const job = await waitForJob(jobId, {
          intervalMs: opts.interval * 1000,
          timeoutMs: opts.timeout * 1000,
          onPoll: (j) => {
            outputProgress(`Polling ${j.id}: ${j.status}`);
          },
        });
        outputJob(job);
        if (job.status !== "SUCCEEDED") {
          throw new CliError(
            `Job ${job.id} ended with status ${job.status}`,
            job.status === "FAILED" ? "job_failed" : "job_canceled",
            1,
            { job_id: job.id, status: job.status, error: job.error },
          );
        }
      },
    );

  jobs
    .command("health")
    .description("Check Worker health and readiness")
    .action(async () => {
      const health = await healthz();
      const ready = await readyz();
      const workerUrl = loadConfig(options).worker_url;
      if (ready.status !== "ok") {
        throw new CliError(
          "Worker is healthy but not ready",
          "worker_not_ready",
          1,
          {
            worker_url: workerUrl,
            health,
            ready,
          },
        );
      }
      outputHealth(workerUrl, health, ready);
    });

  registerConfigCommand(jobs, options);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseKvPairs(entries: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex <= 0) {
      throw new CliError(
        `Invalid key=value pair: ${entry}`,
        "invalid_key_value",
      );
    }
    const key = entry.slice(0, eqIndex);
    if (key in result)
      throw new CliError(`Duplicate key: ${key}`, "duplicate_key");
    result[key] = entry.slice(eqIndex + 1);
  }
  return result;
}

function parseModelParams(
  specs: ParamSpec[],
  entries: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const byName = new Map(specs.map((spec) => [spec.name, spec]));

  for (const [name, raw] of Object.entries(parseKvPairs(entries))) {
    const spec = byName.get(name);
    if (!spec) {
      throw new CliError(
        `Unknown parameter for this model: ${name}`,
        "unknown_parameter",
      );
    }
    const value = parseParamValue(spec, raw);
    if (typeof value === "number") {
      if (spec.min != null && value < spec.min) {
        throw new CliError(
          `${name} must be greater than or equal to ${spec.min}`,
          "parameter_out_of_range",
        );
      }
      if (spec.max != null && value > spec.max) {
        throw new CliError(
          `${name} must be less than or equal to ${spec.max}`,
          "parameter_out_of_range",
        );
      }
    }
    result[name] = value;
  }
  return result;
}

function parseParamValue(spec: ParamSpec, value: string): unknown {
  if (spec.type === "str") return value;
  if (spec.type === "enum") {
    if (!spec.choices?.includes(value)) {
      throw new CliError(
        `${spec.name} must be one of: ${spec.choices?.join(", ") ?? ""}`,
        "invalid_parameter",
      );
    }
    return value;
  }
  if (spec.type === "bool") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new CliError(
      `${spec.name} must be true or false`,
      "invalid_parameter",
    );
  }
  if (spec.type === "int") {
    if (!/^-?\d+$/.test(value)) {
      throw new CliError(
        `${spec.name} must be an integer`,
        "invalid_parameter",
      );
    }
    return Number.parseInt(value, 10);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new CliError(`${spec.name} must be a number`, "invalid_parameter");
  }
  return number;
}

function validateInputs(
  model: ModelPublic,
  localInputs: Record<string, string>,
  inputKeys: Record<string, string>,
): void {
  const knownInputs = new Set(model.inputs.files.map((input) => input.name));
  for (const name of [...Object.keys(localInputs), ...Object.keys(inputKeys)]) {
    if (!knownInputs.has(name)) {
      throw new CliError(
        `Unknown input for ${model.id}: ${name}`,
        "unknown_input",
      );
    }
  }
  for (const name of Object.keys(localInputs)) {
    if (name in inputKeys) {
      throw new CliError(
        `Input ${name} has both a local file and an object key`,
        "duplicate_input",
      );
    }
  }
  for (const input of model.inputs.files) {
    if (
      input.required &&
      !(input.name in localInputs) &&
      !(input.name in inputKeys)
    ) {
      throw new CliError(
        `Missing required input: ${input.name}`,
        "missing_input",
      );
    }
  }
}

async function writeResponseToFile(
  response: Response,
  outPath: string,
): Promise<void> {
  if (!response.body) {
    throw new CliError("Download returned an empty body", "download_failed");
  }
  await pipeline(Readable.from(response.body), createWriteStream(outPath));
}

export function generateJobId(
  now = new Date(),
  suffix = randomBytes(4).toString("hex"),
): string {
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  const time = [
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  return `job_${date}_${time}_${suffix.toLowerCase()}`;
}
