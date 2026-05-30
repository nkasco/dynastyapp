import "dotenv/config";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");

require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  path: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
  isPreloading: false,
  require,
  parent: null,
};

async function main() {
  const { runNightlyRefresh, runQueuedImportJobs } = await import("@/server/imports/runner");
  const mode = process.argv[2] ?? "nightly";
  const result = mode === "queue" ? await runQueuedImportJobs() : await runNightlyRefresh();

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        result,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
