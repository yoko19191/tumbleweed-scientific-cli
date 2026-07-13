import { Command } from "commander";
import { listModels } from "../client.js";
import { outputJson, outputModelList } from "../output.js";

export function registerModelsCommand(program: Command): void {
  const models = program
    .command("models")
    .description("Manage models");

  models
    .command("list")
    .description("List available models (dynamically fetched from worker)")
    .option("--detail", "Show detailed model specs including params and inputs")
    .action(async (opts: { detail?: boolean }) => {
      const result = await listModels();

      if (opts.detail) {
        outputJson(result.items);
        return;
      }

      outputModelList(result.items);
    });
}
