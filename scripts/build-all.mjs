import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgCli = require.resolve("@yao-pkg/pkg/lib-es5/bin.js");

const targets = [
  ["node22-macos-arm64", "dist/tumbleweed-darwin-arm64"],
  ["node22-macos-x64", "dist/tumbleweed-darwin-x64"],
  ["node22-linux-x64", "dist/tumbleweed-linux-x64"],
  ["node22-linux-arm64", "dist/tumbleweed-linux-arm64"],
];

for (const [target, output] of targets) {
  execFileSync(
    process.execPath,
    [pkgCli, "dist/tumbleweed.cjs", "--target", target, "--output", output],
    { stdio: "inherit" },
  );
}
