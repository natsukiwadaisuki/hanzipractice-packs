import { fetchZipBytes, findZip } from "../../../lib/github.js";
import { decodeText, entriesOf, findReadme, rewriteImages, titleFromMarkdown } from "../../../lib/zip.js";
import { handleOptions, param, sendError, sendJson } from "../../../lib/http.js";

const MAX_README = 400 * 1024;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const id = param(req.query.id);
    if (!id || !/\.zip$/i.test(id)) {
      return sendError(res, 400, "Expected a pack id ending in .zip");
    }
    const file = await findZip(id);
    if (!file) return sendError(res, 404, `Pack '${id}' not found`);

    const bytes = await fetchZipBytes(id);
    const entries = entriesOf(bytes);
    const readmePath = findReadme(entries);
    if (!readmePath) {
      return sendError(res, 404, `Pack '${id}' has no README.md`, { pack: id });
    }
    const raw = decodeText(entries.get(readmePath)).slice(0, MAX_README);
    const markdown = rewriteImages(raw, id, readmePath);

    sendJson(
      res,
      200,
      {
        id,
        title: titleFromMarkdown(raw) || file.name.replace(/\.zip$/i, ""),
        readmePath,
        markdown,
        sizeBytes: file.sizeBytes,
        love: "Made with love by HanziPractice team <3",
      },
      "public, s-maxage=300, stale-while-revalidate=3600",
    );
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : "Unable to read pack");
  }
}
