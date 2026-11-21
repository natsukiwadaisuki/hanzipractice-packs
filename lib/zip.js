import { unzipSync } from "fflate";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

function normalize(path) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function depth(path) {
  return normalize(path).split("/").length;
}

/** Extract all entries of a zip buffer into a path -> Uint8Array map. */
export function entriesOf(bytes) {
  const raw = unzipSync(new Uint8Array(bytes));
  const entries = new Map();
  for (const [name, data] of Object.entries(raw)) {
    if (name.endsWith("/")) continue;
    if (name.includes("__MACOSX/") || /(^|\/)\._/.test(name)) continue;
    if (/(^|\/)\.DS_Store$/i.test(name)) continue;
    entries.set(normalize(name), data);
  }
  return entries;
}

/** README.md at the pack root wins; otherwise the shallowest README.md. */
export function findReadme(entries) {
  const candidates = [...entries.keys()].filter((name) => /(^|\/)readme\.md$/i.test(name));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const rootA = a.includes("/") ? 1 : 0;
    const rootB = b.includes("/") ? 1 : 0;
    if (rootA !== rootB) return rootA - rootB;
    return depth(a) - depth(b) || a.localeCompare(b);
  });
  return candidates[0];
}

export function decodeText(data) {
  return new TextDecoder("utf-8").decode(data);
}

export function titleFromMarkdown(markdown) {
  const heading = markdown.match(/^\s*#\s+(.+)$/m);
  if (heading) return heading[1].replace(/[*_`]/g, "").trim();
  const firstLine = markdown.split("\n").map((l) => l.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : null;
}

/**
 * Rewrites relative README images to /api/packs/<id>/assets/<path> so the app
 * can load them without the client knowing the zip layout.
 */
export function rewriteImages(markdown, id, readmePath) {
  const baseDir = readmePath.includes("/")
    ? readmePath.slice(0, readmePath.lastIndexOf("/") + 1)
    : "";
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (whole, alt, url) => {
    const target = url.trim();
    if (/^(https?:)?\/\//i.test(target) || target.startsWith("data:")) return whole;
    const clean = target.replace(/^\.\//, "");
    const resolved = clean.startsWith("/") ? clean.slice(1) : normalize(baseDir + clean);
    return `![${alt}](/api/packs/${encodeURIComponent(id)}/assets/${resolved.split("/").map(encodeURIComponent).join("/")})`;
  });
}

export function imageEntries(entries) {
  return [...entries.keys()].filter((name) => IMAGE_EXT.test(name));
}

export function contentTypeFor(path) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
  };
  return map[ext] || "application/octet-stream";
}
