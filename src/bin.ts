#!/usr/bin/env bun
import { loadEnv } from "./config.js";
import { main } from "./index.js";

loadEnv();
process.exitCode = await main();
