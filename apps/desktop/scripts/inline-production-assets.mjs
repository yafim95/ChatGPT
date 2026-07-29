import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = resolve(scriptDirectory, "../dist");
const indexPath = join(distDirectory, "index.html");

function escapeClosingTag(source, tagName) {
  return source.replace(new RegExp(`</${tagName}`, "giu"), `<\\/${tagName}`);
}

async function inlineStyles(html) {
  const stylesheetPattern =
    /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/giu;
  const matches = [...html.matchAll(stylesheetPattern)];

  for (const match of matches) {
    const href = match[1];
    if (!href) {
      throw new Error("The production stylesheet path is missing.");
    }
    const cssPath = resolve(distDirectory, href.replace(/^\.?\//u, ""));
    const css = escapeClosingTag(await readFile(cssPath, "utf8"), "style");
    html = html.replace(
      match[0],
      () => `<style data-projectmind-bundle="styles">${css}</style>`,
    );
  }

  return html;
}

async function inlineScripts(html) {
  const scriptPattern =
    /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/giu;
  const matches = [...html.matchAll(scriptPattern)];

  if (matches.length !== 1) {
    throw new Error(
      `Expected one production module bundle, found ${String(matches.length)}.`,
    );
  }

  for (const match of matches) {
    const src = match[1];
    if (!src) {
      throw new Error("The production module path is missing.");
    }
    const scriptPath = resolve(distDirectory, src.replace(/^\.?\//u, ""));
    const script = escapeClosingTag(
      await readFile(scriptPath, "utf8"),
      "script",
    );
    html = html.replace(
      match[0],
      () =>
        `<script type="module" data-projectmind-bundle="app">${script}</script>`,
    );
  }

  return html;
}

let html = await readFile(indexPath, "utf8");
html = await inlineStyles(html);
html = await inlineScripts(html);

if (/(?:src|href)="\.?\/?assets\//u.test(html)) {
  throw new Error("The production HTML still references an external asset.");
}
if (!html.includes('data-projectmind-bundle="app"')) {
  throw new Error("The inlined application bundle is missing.");
}
if (!html.includes("data-projectmind-native-shell")) {
  throw new Error("The no-JavaScript startup shell is missing.");
}

await writeFile(indexPath, html, "utf8");

console.log("Verified self-contained ProjectMind production interface.");
