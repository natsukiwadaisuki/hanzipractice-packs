import { fetchZipBytes, findZip } from "../../../lib/github.js";
import { handleOptions, param, sendError } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const id = param(req.query.id);
    if (!id || !/\.zip$/i.test(id)) return sendError(res, 400, "Expected a pack id ending in .zip");
    const file = await findZip(id);
    if (!file) return sendError(res, 404, `Pack '${id}' not found`);

    const bytes = await fetchZipBytes(id);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", bytes.length);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${id.replace(/[^\w.\- ]/g, "_")}"`,
    );
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(bytes);
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : "Unable to download pack");
  }
}
