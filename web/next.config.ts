import path from "node:path";
import type { NextConfig } from "next";

// The engine lives at the repo root (`../src/lib`) and the web app imports it
// directly, so Next must treat the repo root as the workspace/tracing root.
// All next commands run from `web/` (see HARNESS.md), so cwd-relative is safe.
const repoRoot = path.resolve(process.cwd(), "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  // kuromoji is an old UMD package that reads its dictionary from disk at
  // runtime — keep it external instead of bundling it.
  serverExternalPackages: ["kuromoji"],
};

export default nextConfig;
