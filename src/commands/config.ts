import { Command } from "commander";
import { loadConfig, saveConfig, configWithSources, CONFIG_PATH } from "../config.js";
import { outputJson, outputSuccess, outputError } from "../output.js";

const ALLOWED_KEYS = ["api_url", "job_owner"] as const;
type ConfigKey = (typeof ALLOWED_KEYS)[number];

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage CLI configuration");

  config
    .command("show")
    .description("Show current configuration with sources")
    .action(() => {
      const sources = configWithSources();
      outputJson({ config_path: CONFIG_PATH, values: sources });
    });

  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", `Config key (${ALLOWED_KEYS.join(", ")})`)
    .argument("<value>", "Config value")
    .action((key: string, value: string) => {
      if (!ALLOWED_KEYS.includes(key as ConfigKey)) {
        outputError(`Unknown config key: ${key}. Allowed: ${ALLOWED_KEYS.join(", ")}`);
        process.exit(1);
      }
      const updated = saveConfig({ [key]: value });
      outputSuccess(`Set ${key} = ${value}`);
      outputJson(updated);
    });

  config
    .command("path")
    .description("Print config file path")
    .action(() => {
      outputJson({ path: CONFIG_PATH });
    });
}
