import pc from "picocolors";
import type {
  JobOut,
  LogsOut,
  ModelPublic,
  ReadyOut,
} from "./worker/schemas.js";

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
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Error output (always to stderr)
// ---------------------------------------------------------------------------
export function outputError(message: string, detail?: unknown): void {
  if (humanMode) {
    process.stderr.write(`${pc.red(`Error: ${message}`)}\n`);
    if (detail) {
      process.stderr.write(`${pc.dim(JSON.stringify(detail, null, 2))}\n`);
    }
  } else {
    process.stderr.write(
      `${JSON.stringify({ error: message, detail: detail ?? null })}\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Success message (stderr in JSON mode so stdout stays clean)
// ---------------------------------------------------------------------------
export function outputSuccess(message: string): void {
  if (humanMode) {
    process.stderr.write(`${pc.green(`✔ ${message}`)}\n`);
  }
}

export function outputProgress(message: string): void {
  if (humanMode) {
    process.stderr.write(`${pc.dim(message)}\n`);
    return;
  }
  process.stderr.write(`${JSON.stringify({ progress: message })}\n`);
}

export function outputLogs(logs: LogsOut): void {
  if (!humanMode) {
    outputJson(logs);
    return;
  }
  if (logs.content) {
    process.stdout.write(logs.content);
    if (!logs.content.endsWith("\n")) process.stdout.write("\n");
    return;
  }
  process.stdout.write(`${logs.url ?? "No logs available."}\n`);
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
  if (job.finished_at)
    lines.push(`${pc.bold("Finished")}   ${job.finished_at}`);
  if (job.error) lines.push(`${pc.bold("Error")}      ${pc.red(job.error)}`);
  if (job.output_uri) lines.push(`${pc.bold("Output")}     ${job.output_uri}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function outputJobList(jobs: JobOut[], total: number): void {
  if (!humanMode) {
    outputJson({ items: jobs, total });
    return;
  }
  if (jobs.length === 0) {
    process.stdout.write(`${pc.dim("No jobs found.")}\n`);
    return;
  }
  // Simple table
  const header = padRow("ID", "MODEL", "STATUS", "CREATED");
  process.stdout.write(`${pc.bold(header)}\n`);
  process.stdout.write(`${"─".repeat(header.length)}\n`);
  for (const job of jobs) {
    process.stdout.write(
      padRow(job.id, job.model_id, statusColor(job.status), job.created_at) +
        "\n",
    );
  }
  process.stdout.write(
    `${pc.dim(`\nShowing ${jobs.length} of ${total} total`)}\n`,
  );
}

export function outputModelList(models: ModelPublic[]): void {
  if (!humanMode) {
    outputJson({ items: models });
    return;
  }
  if (models.length === 0) {
    process.stdout.write(`${pc.dim("No models available.")}\n`);
    return;
  }
  const header = padRow("ID", "NAME", "GPUs", "INPUTS", "PARAMS");
  process.stdout.write(`${pc.bold(header)}\n`);
  process.stdout.write(`${"─".repeat(header.length)}\n`);
  for (const m of models) {
    const inputNames = m.inputs.files.map((f) => f.name).join(", ") || "—";
    const paramCount = String(m.params.length);
    const gpus = `${m.resources.gpus_min}-${m.resources.gpus_max}`;
    process.stdout.write(
      `${padRow(m.id, m.display_name, gpus, inputNames, paramCount)}\n`,
    );
  }
}

export function outputModelDetail(model: ModelPublic): void {
  if (!humanMode) {
    outputJson(model);
    return;
  }
  process.stdout.write(
    `${pc.bold(model.display_name)} (${pc.cyan(model.id)})\n`,
  );
  if (model.help_zh) {
    process.stdout.write(`${pc.dim(model.help_zh)}\n`);
  }
  const card = model.card;
  if (card?.summary_zh) {
    process.stdout.write(`\n${card.summary_zh}\n`);
  }
  if (card?.category) {
    process.stdout.write(`\n${pc.bold("Category")}  ${card.category}\n`);
  }
  if (card?.tags?.length) {
    process.stdout.write(`${pc.bold("Tags")}      ${card.tags.join(", ")}\n`);
  }
  process.stdout.write(
    `\n${pc.bold("Resources")}  ${model.resources.gpus} GPU(s) · timeout ${model.resources.timeout_seconds}s\n`,
  );
  if (model.inputs.files.length) {
    process.stdout.write(`\n${pc.bold("Inputs")}\n`);
    for (const input of model.inputs.files) {
      const required = input.required ? pc.red("required") : pc.dim("optional");
      process.stdout.write(
        `  ${pc.bold(input.name)}  ${input.description || input.help_zh || ""} (${required})\n`,
      );
    }
  }
  if (model.params.length) {
    process.stdout.write(`\n${pc.bold("Parameters")}\n`);
    for (const param of model.params) {
      const type = param.choices?.length
        ? `${param.type}(${param.choices.join("|")})`
        : param.type;
      const defaultValue =
        param.default != null ? ` · default ${String(param.default)}` : "";
      process.stdout.write(
        `  ${pc.bold(param.name)}  ${type}${defaultValue}\n`,
      );
      if (param.description || param.help_zh) {
        process.stdout.write(
          `           ${param.description || param.help_zh}\n`,
        );
      }
    }
  }
  if (card?.links && Object.keys(card.links).length > 0) {
    process.stdout.write(`\n${pc.bold("Links")}\n`);
    for (const [name, url] of Object.entries(card.links)) {
      process.stdout.write(`  ${name}: ${pc.underline(url)}\n`);
    }
  }
}

export function outputConfigPath(configPath: string): void {
  if (!humanMode) {
    outputJson({ path: configPath });
    return;
  }
  process.stdout.write(`${configPath}\n`);
}

export function outputConfigShow(
  configPath: string,
  sources: Record<string, { value: string; source: string }>,
): void {
  if (!humanMode) {
    outputJson({ config_path: configPath, values: sources });
    return;
  }
  process.stdout.write(`${pc.bold("Config path")}  ${configPath}\n\n`);
  const header = padRow("KEY", "VALUE", "SOURCE");
  process.stdout.write(`${pc.bold(header)}\n`);
  process.stdout.write(`${"─".repeat(header.length)}\n`);
  for (const [key, item] of Object.entries(sources)) {
    process.stdout.write(`${padRow(key, item.value, item.source)}\n`);
  }
}

export function outputHealth(
  workerUrl: string,
  health: { status: string },
  ready: ReadyOut,
): void {
  if (!humanMode) {
    outputJson({ worker_url: workerUrl, health, ready });
    return;
  }
  const healthOk = health.status === "ok";
  const readyOk = ready.status === "ok";
  const healthLabel = healthOk ? pc.green("healthy") : pc.red(health.status);
  const readyLabel = readyOk ? pc.green("ready") : pc.red(ready.status);
  process.stdout.write(`${pc.bold("Worker URL")}  ${workerUrl}\n`);
  process.stdout.write(
    `${pc.bold("Status")}      ${healthLabel} / ${readyLabel}\n`,
  );
  if (ready.checks && Object.keys(ready.checks).length > 0) {
    process.stdout.write(`\n${pc.bold("Checks")}\n`);
    for (const [name, status] of Object.entries(ready.checks)) {
      const label = status === "ok" ? pc.green(status) : pc.red(status);
      process.stdout.write(`  ${name.padEnd(12)} ${label}\n`);
    }
  }
  if (ready.resources) {
    process.stdout.write(
      `\n${pc.bold("GPUs")}        ${ready.resources.gpus_available} / ${ready.resources.gpus_total} available\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padRow(...cols: string[]): string {
  const widths = [32, 24, 8, 24, 8];
  return cols.map((c, i) => c.padEnd(widths[i] ?? 16)).join("  ");
}
