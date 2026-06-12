import path from "node:path";
import type { NextConfig } from "next";

// The engine lives at the repo root (`../src/lib`) and the web app imports it
// directly, so Next must treat the repo root as the workspace/tracing root.
// All next commands run from `web/` (see HARNESS.md), so cwd-relative is safe.
const repoRoot = path.resolve(process.cwd(), "..");

// Runtime fs reads the tracer cannot see (contract 007): content.ts loads
// data/{vocab,grammar}.json + data/templates/* via `join(process.cwd(),
// "data")` (resolving through the committed web/data → ../data symlink), and
// the kuromoji evaluator loads node_modules/kuromoji/dict/*.dat.gz. Globs are
// project-dir-relative; the real files live one level up at the repo root, so
// include them under BOTH the symlink path and the ../ path — whichever the
// tracer materializes, `cwd/data` must resolve in the lambda (C6/C11 are the
// proof).
const runtimeDataIncludes = [
  "data/vocab.json",
  "data/grammar.json",
  "data/templates/**",
  "../data/vocab.json",
  "../data/grammar.json",
  "../data/templates/**",
];
// The complete route needs the dict too: in cookie mode POST replays
// episodes, which runs the kuromoji-backed evaluator.
const kuromojiDictIncludes = ["node_modules/kuromoji/dict/**"];

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  // Standalone output: contract 007's local QA runs the production server via
  // `node web/.next/standalone/web/server.js` (file + cookie mode side by
  // side); Vercel itself traces routes directly and does not need it.
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/episode": [...runtimeDataIncludes, ...kuromojiDictIncludes],
    "/api/episode/complete": [...runtimeDataIncludes, ...kuromojiDictIncludes],
  },
  turbopack: {
    root: repoRoot,
  },
  // kuromoji is an old UMD package that reads its dictionary from disk at
  // runtime — keep it external instead of bundling it.
  serverExternalPackages: ["kuromoji"],
};

export default nextConfig;
