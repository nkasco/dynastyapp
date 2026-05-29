import "dotenv/config";

import { env } from "@/env";
import { runNightlyRefresh } from "@/server/imports/runner";
import { getNextNightlyRunAt } from "@/server/imports/schedule";

const MAX_TIMEOUT_MS = 2_147_483_647;

async function sleepUntil(target: Date) {
  while (target.getTime() > Date.now()) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(target.getTime() - Date.now(), MAX_TIMEOUT_MS)));
  }
}

async function main() {
  console.log(
    JSON.stringify({
      ok: true,
      worker: "refresh",
      cron: env.IMPORT_NIGHTLY_CRON,
      timeZone: env.IMPORT_TIME_ZONE,
    }),
  );

  for (;;) {
    const runAt = getNextNightlyRunAt({
      now: new Date(),
      cron: env.IMPORT_NIGHTLY_CRON,
      timeZone: env.IMPORT_TIME_ZONE,
    });

    console.log(JSON.stringify({ event: "scheduled", runAt: runAt.toISOString() }));
    await sleepUntil(runAt);

    const job = await runNightlyRefresh();
    console.log(JSON.stringify({ event: "finished", job }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
