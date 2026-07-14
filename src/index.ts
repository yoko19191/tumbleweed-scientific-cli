import { Command } from "commander";
import packageJson from "../package.json";
import { ApiClientError } from "./worker/client.js";
import { registerJobsCommand } from "./commands/jobs.js";
import { CliError } from "./errors.js";
import { outputError, setHumanMode } from "./output.js";

export interface ProgramOptions {
  configPath?: string;
}

export function createProgram(options: ProgramOptions = {}): Command {
  setHumanMode(false);
  const program = new Command();

  program
    .name("tumbleweed")
    .description(packageJson.description)
    .version(packageJson.version)
    .option("--human", "Enable human-readable colored output (default: JSON)")
    .hook("preAction", (thisCommand) => {
      if (thisCommand.opts().human) setHumanMode(true);
    });

  registerJobsCommand(program, options);
  return program;
}

// ---------------------------------------------------------------------------
// Global error handling
// ---------------------------------------------------------------------------
export async function main(argv: string[] = process.argv): Promise<number> {
  const program = createProgram();
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    if (err instanceof ApiClientError) {
      outputError(err.message, {
        code: err.code,
        status: err.statusCode,
        ...err.detail,
      });
      return err.statusCode >= 500 || err.statusCode === 0 ? 2 : 1;
    }
    if (err instanceof CliError) {
      outputError(err.message, { code: err.code, ...err.detail });
      return err.exitCode;
    }
    if (err instanceof Error) {
      outputError(err.message);
      return 2;
    }
    throw err;
  }
}
