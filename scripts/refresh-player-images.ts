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

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function numberArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

async function main() {
  const { refreshPlayerImages } = await import("@/server/players/images");
  const result = await refreshPlayerImages({
    force: hasFlag("--force"),
    concurrency: numberArg("--concurrency"),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "player-images",
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
