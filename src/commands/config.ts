import type { Command } from "commander";
import { CONFIG_PATH, configWithSources, saveConfig } from "../config.js";
import { CliError } from "../errors.js";
import { outputJson, outputSuccess } from "../output.js";

const ALLOWED_KEYS = ["worker_url", "job_owner"] as const;
type ConfigKey = (typeof ALLOWED_KEYS)[number];

export function registerConfigCommand(
  parent: Command,
  options: { configPath?: string } = {},
): void {
  const configPath = options.configPath ?? CONFIG_PATH;
  const config = parent
    .command("config")
    .description("Manage CLI configuration");

  config
    .command("show")
    .description("Show current configuration with sources")
    .action(() => {
      const sources = configWithSources(options);
      outputJson({ config_path: configPath, values: sources });
    });

  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", `Config key (${ALLOWED_KEYS.join(", ")})`)
    .argument("<value>", "Config value")
    .action((key: string, value: string) => {
      if (!ALLOWED_KEYS.includes(key as ConfigKey)) {
        throw new CliError(
          `Unknown config key: ${key}. Allowed: ${ALLOWED_KEYS.join(", ")}`,
          "unknown_config_key",
        );
      }
      const updated = saveConfig({ [key]: value }, options);
      outputSuccess(`Set ${key} = ${value}`);
      outputJson(updated);
    });

  config
    .command("path")
    .description("Print config file path")
    .action(() => {
      outputJson({ path: configPath });
    });
}
