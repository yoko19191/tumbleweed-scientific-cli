import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  createJob,
  listJobs,
  getJob,
  getJobResult,
  getJobLogs,
  cancelJob,
  waitForJob,
} from "../client.js";
import { loadConfig } from "../config.js";
import { outputJson, outputJob, outputJobList, outputSuccess, outputError } from "../output.js";

export function registerJobsCommand(program: Command): void {
  const jobs = program
    .command("jobs")
    .description("Manage inference jobs");

  // ── submit ────────────────────────────────────────────────────────────
  jobs
    .command("submit")
    .description("Submit a new inference job")
    .requiredOption("--model <id>", "Model ID")
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
    .option("--idempotency-key <key>", "Idempotency key to prevent duplicate submissions")
    .action(
      async (opts: {
        model: string;
        inputKey?: string[];
        param?: string[];
        jobId?: string;
        jobAlias?: string;
        gpuCount?: number;
        idempotencyKey?: string;
      }) => {
        const config = loadConfig();
        const inputKeys = parseKvPairs(opts.inputKey ?? []);
        const params = parseKvPairsTyped(opts.param ?? []);

        const job = await createJob({
          model_id: opts.model,
          input_keys: inputKeys,
          params,
          job_id: opts.jobId,
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
      const config = loadConfig();
      const result = await listJobs({
        jobOwner: opts.owner ?? config.job_owner,
        limit: opts.limit,
        offset: opts.offset,
      });
      outputJobList(result.items, result.total);
    });

  // ── status ────────────────────────────────────────────────────────────
  jobs
    .command("status")
    .description("Get job status and details")
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
          outputError(`Download failed: HTTP ${response.status}`);
          process.exit(1);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const filename = result.object_key.split("/").pop() ?? "result";
        const outPath = join(opts.outputDir, filename);
        writeFileSync(outPath, buffer);
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

      if (logs.content) {
        process.stdout.write(logs.content);
        if (!logs.content.endsWith("\n")) process.stdout.write("\n");
      } else if (logs.url) {
        outputJson({ url: logs.url });
      } else {
        outputJson({ content: null, url: null });
      }
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
    .option("--timeout <seconds>", "Maximum wait time in seconds", parseInt, 600)
    .action(
      async (jobId: string, opts: { interval: number; timeout: number }) => {
        const job = await waitForJob(jobId, {
          intervalMs: opts.interval * 1000,
          timeoutMs: opts.timeout * 1000,
          onPoll: (j) => {
            outputError(`Polling ${j.id}: ${j.status}`, undefined);
          },
        });
        outputJob(job);
      },
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseKvPairs(entries: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid key=value pair: ${entry}`);
    }
    result[entry.slice(0, eqIndex)] = entry.slice(eqIndex + 1);
  }
  return result;
}

function parseKvPairsTyped(entries: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid key=value pair: ${entry}`);
    }
    const key = entry.slice(0, eqIndex);
    const raw = entry.slice(eqIndex + 1);
    result[key] = inferType(raw);
  }
  return result;
}

function inferType(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") return num;
  return value;
}
