import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal) {
    console.error(`${command} terminated by ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const vitestCommand = process.platform === "win32" ? "vitest.cmd" : "vitest";
const vitestArgs = ["run", ...process.argv.slice(2)];

run(vitestCommand, vitestArgs);
run(process.execPath, ["ai-dev-team/artifacts/contracts/validate-contracts.mjs"]);
