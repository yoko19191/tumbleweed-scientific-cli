import pc from "picocolors";
import type { JobOut, ModelPublic } from "./types.js";

// ---------------------------------------------------------------------------
// Global output mode
// ---------------------------------------------------------------------------
let humanMode = false;

export function setHumanMode(enabled: boolean): void {
  humanMode = enabled;
}

// ---------------------------------------------------------------------------
// JSON output (default — Agent-friendly)
// ---------------------------------------------------------------------------
export function outputJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Error output (always to stderr)
// ---------------------------------------------------------------------------
export function outputError(message: string, detail?: unknown): void {
  if (humanMode) {
    process.stderr.write(pc.red(`Error: ${message}`) + "\n");
    if (detail) {
      process.stderr.write(pc.dim(JSON.stringify(detail, null, 2)) + "\n");
    }
  } else {
    process.stderr.write(
      JSON.stringify({ error: message, detail: detail ?? null }) + "\n",
    );
  }
}

// ---------------------------------------------------------------------------
// Success message (stderr in JSON mode so stdout stays clean)
// ---------------------------------------------------------------------------
export function outputSuccess(message: string): void {
  if (humanMode) {
    process.stderr.write(pc.green(`✔ ${message}`) + "\n");
  }
}

// ---------------------------------------------------------------------------
// Human-readable formatters
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "QUEUED":
      return pc.yellow(status);
    case "RUNNING":
      return pc.blue(status);
    case "SUCCEEDED":
      return pc.green(status);
    case "FAILED":
      return pc.red(status);
    case "CANCELED":
      return pc.dim(status);
    default:
      return status;
  }
}

export function outputJob(job: JobOut): void {
  if (!humanMode) {
    outputJson(job);
    return;
  }
  const lines = [
    `${pc.bold("Job")}        ${job.id}`,
    `${pc.bold("Model")}      ${job.model_id}`,
    `${pc.bold("Status")}     ${statusColor(job.status)}`,
    `${pc.bold("Owner")}      ${job.job_owner}`,
    `${pc.bold("GPUs")}       ${job.gpu_count}`,
    `${pc.bold("Created")}    ${job.created_at}`,
  ];
  if (job.job_alias) lines.push(`${pc.bold("Alias")}      ${job.job_alias}`);
  if (job.started_at) lines.push(`${pc.bold("Started")}    ${job.started_at}`);
  if (job.finished_at) lines.push(`${pc.bold("Finished")}   ${job.finished_at}`);
  if (job.error) lines.push(`${pc.bold("Error")}      ${pc.red(job.error)}`);
  if (job.output_uri) lines.push(`${pc.bold("Output")}     ${job.output_uri}`);
  process.stdout.write(lines.join("\n") + "\n");
}

export function outputJobList(jobs: JobOut[], total: number): void {
  if (!humanMode) {
    outputJson({ items: jobs, total });
    return;
  }
  if (jobs.length === 0) {
    process.stdout.write(pc.dim("No jobs found.") + "\n");
    return;
  }
  // Simple table
  const header = padRow("ID", "MODEL", "STATUS", "CREATED");
  process.stdout.write(pc.bold(header) + "\n");
  process.stdout.write("─".repeat(header.length) + "\n");
  for (const job of jobs) {
    process.stdout.write(
      padRow(job.id, job.model_id, statusColor(job.status), job.created_at) + "\n",
    );
  }
  process.stdout.write(pc.dim(`\nShowing ${jobs.length} of ${total} total`) + "\n");
}

export function outputModelList(models: ModelPublic[]): void {
  if (!humanMode) {
    outputJson({ items: models });
    return;
  }
  if (models.length === 0) {
    process.stdout.write(pc.dim("No models available.") + "\n");
    return;
  }
  const header = padRow("ID", "NAME", "GPUs", "INPUTS", "PARAMS");
  process.stdout.write(pc.bold(header) + "\n");
  process.stdout.write("─".repeat(header.length) + "\n");
  for (const m of models) {
    const inputNames = m.inputs.files.map((f) => f.name).join(", ") || "—";
    const paramCount = String(m.params.length);
    const gpus = `${m.resources.gpus_min}-${m.resources.gpus_max}`;
    process.stdout.write(padRow(m.id, m.display_name, gpus, inputNames, paramCount) + "\n");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padRow(...cols: string[]): string {
  const widths = [32, 24, 8, 24, 8];
  return cols.map((c, i) => c.padEnd(widths[i] ?? 16)).join("  ");
}
