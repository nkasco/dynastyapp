import "dotenv/config";

import { runNightlyRefresh, runQueuedImportJobs } from "@/server/imports/runner";

async function main() {
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
