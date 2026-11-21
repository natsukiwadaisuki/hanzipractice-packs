import { fetchZipBytes, findZip } from "../../../../lib/github.js";
import { contentTypeFor, entriesOf } from "../../../../lib/zip.js";
import { handleOptions, param, sendError } from "../../../../lib/http.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const id = param(req.query.id);
    const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    const assetPath = segments.map((s) => decodeURIComponent(s || "")).join("/");
    if (!id || !assetPath) return sendError(res, 400, "Missing pack id or asset path");
    if (assetPath.includes("..") || assetPath.startsWith("/")) {
      return sendError(res, 400, "Unsafe asset path");
    }
    const file = await findZip(id);
    if (!file) return sendError(res, 404, `Pack '${id}' not found`);

    const bytes = await fetchZipBytes(id);
    const entries = entriesOf(bytes);
    const data = entries.get(assetPath);
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
