#!/usr/bin/env bun
import { Command } from "commander";
import { setHumanMode, outputError } from "./output.js";
import { ApiClientError } from "./client.js";
import { registerModelsCommand } from "./commands/models.js";
import { registerUploadCommand } from "./commands/upload.js";
import { registerJobsCommand } from "./commands/jobs.js";
import { registerHealthCommand } from "./commands/health.js";
import { registerConfigCommand } from "./commands/config.js";

const program = new Command();

program
  .name("tumbleweed")
  .description(
    "CLI client for tumbleweed-scientific-worker — submit, monitor, and retrieve AI model inference jobs",
  )
  .version("0.1.0")
  .option("--human", "Enable human-readable colored output (default: JSON)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.human) {
      setHumanMode(true);
    }
  });

// Register all subcommands
registerModelsCommand(program);
registerUploadCommand(program);
registerJobsCommand(program);
registerHealthCommand(program);
registerConfigCommand(program);

// ---------------------------------------------------------------------------
// Global error handling
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof ApiClientError) {
      outputError(err.message, {
        code: err.code,
        status: err.statusCode,
        ...err.detail,
      });
      process.exit(1);
    }
    if (err instanceof Error) {
      // Commander exits with its own errors (e.g. missing arg), let those through
      if (err.message.includes("commander")) {
        throw err;
      }
      outputError(err.message);
      process.exit(2);
    }
    throw err;
  }
}

main();
