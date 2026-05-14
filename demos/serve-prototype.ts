// Tiny local server for the Word Ore HTML prototype.
//
// Reads GEMINI_API_KEY from .env.local (preferred) or .env, then serves
// public/word-ore-prototype.html with the key injected as a global so the
// page can talk to Gemini directly without anyone pasting it manually.
//
// Run with:
//   npm run prototype
//
// Then open the printed URL.

import { config } from "dotenv";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

// Try .env.local first, then fall back to .env. Either provides GEMINI_API_KEY.
const envLocal = resolve(ROOT, ".env.local");
const envDefault = resolve(ROOT, ".env");
if (existsSync(envLocal)) config({ path: envLocal });
if (existsSync(envDefault)) config({ path: envDefault });

const apiKey = process.env.GEMINI_API_KEY ?? "";
const htmlPath = resolve(ROOT, "public", "word-ore-prototype.html");

if (!existsSync(htmlPath)) {
  process.stderr.write(`[prototype] not found: ${htmlPath}\n`);
  process.exit(1);
}

function buildHtml(): string {
  const raw = readFileSync(htmlPath, "utf8");
  const inject = `<script>window.__INJECTED_API_KEY__ = ${JSON.stringify(apiKey)};</script>`;
  return raw.replace(/<\/head>/, `${inject}\n</head>`);
}

const PORT = Number(process.env.PROTOTYPE_PORT ?? 5173);

const server = createServer((req, res) => {
  // Serve the HTML for any GET — single-page prototype, no other routes.
  if (!req.url || req.method !== "GET") {
    res.writeHead(404);
    res.end();
    return;
  }
  // Re-read on every request so edits to the HTML show up without restart.
  const body = buildHtml();
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
});

server.listen(PORT, () => {
  const status = apiKey ? `loaded (key ending …${apiKey.slice(-4)})` : "MISSING";
  process.stderr.write(
    [
      "",
      `  ▶ Word Ore prototype: http://localhost:${PORT}`,
      `    api key: ${status}`,
      `    html:    ${htmlPath}`,
      "",
      `  edits to the html refresh on browser reload.`,
      `  press Ctrl+C to stop.`,
      "",
    ].join("\n"),
  );
});
