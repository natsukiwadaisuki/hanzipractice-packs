import { fetchZipBytes, findZip } from "../../../lib/github.js";
import { contentTypeFor, entriesOf } from "../../../lib/zip.js";
import { handleOptions, param, sendError } from "../../../lib/http.js";

/**
 * Serves an image (or audio) that lives inside a pack zip.
 *
 * The route is /api/packs/<id>/assets/<path...>. Catch-all query parsing differs
 * between the Vercel runtimes, so the path is resolved from the raw URL and the
 * query object is only used as a fallback.
 */
function resolveSegments(req) {
  const fromQuery = req.query?.path ?? req.query?.["...path"];
  if (Array.isArray(fromQuery) && fromQuery.length) {
    return fromQuery.map((s) => decodeURIComponent(String(s)));
  }
  if (typeof fromQuery === "string" && fromQuery) {
    return fromQuery.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  }
  const raw = req.url || "";
  const marker = "/assets/";
  const index = raw.indexOf(marker);
  if (index < 0) return [];
  const rest = raw.slice(index + marker.length).split("?")[0];
  return rest
    .split("/")
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const id = param(req.query?.id);
    const segments = resolveSegments(req);
    const assetPath = segments.join("/");
    if (!id || !assetPath) return sendError(res, 400, "Missing pack id or asset path");
    if (assetPath.includes("..") || assetPath.startsWith("/") || assetPath.includes("\\")) {
      return sendError(res, 400, "Unsafe asset path");
    }

    const file = await findZip(id);
    if (!file) return sendError(res, 404, `Pack '${id}' not found`);

    const bytes = await fetchZipBytes(id);
    const entries = entriesOf(bytes);
    const data = entries.get(assetPath) ?? entries.get(assetPath.toLowerCase());
    if (!data) return sendError(res, 404, `Asset '${assetPath}' not found in pack`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentTypeFor(assetPath));
    res.setHeader("Content-Length", data.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(Buffer.from(data));
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : "Unable to read asset");
  }
}
