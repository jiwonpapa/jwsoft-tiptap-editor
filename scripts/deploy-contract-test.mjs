import { execFileSync } from "node:child_process";
import path from "node:path";

// Compatibility entrypoint; the regression implementations are now Python.
execFileSync(
  process.env.HARNESS_PYTHON ?? "python3",
  ["-m", "unittest", "harness.tests.test_deployment", "-v"],
  { cwd: path.resolve(import.meta.dirname, ".."), stdio: "inherit" },
);
