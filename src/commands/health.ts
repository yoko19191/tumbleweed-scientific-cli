import { Command } from "commander";
import { healthz, readyz } from "../client.js";
import { outputJson, outputSuccess, outputError } from "../output.js";

export function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("Check worker health and readiness")
    .option("--ready", "Also check readiness (registry/database/storage)")
    .action(async (opts: { ready?: boolean }) => {
      const health = await healthz();

      if (opts.ready) {
        const ready = await readyz();
        const allOk = ready.status === "ok";
        if (allOk) {
          outputSuccess("Worker is healthy and ready");
        } else {
          outputError("Worker is not ready");
        }
        outputJson({ health, ready });
        if (!allOk) process.exit(1);
      } else {
        outputSuccess("Worker is healthy");
        outputJson(health);
      }
    });
}
