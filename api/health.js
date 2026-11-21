import { listZipFiles, repoInfo } from "../lib/github.js";
import { handleOptions, sendError, sendJson } from "../lib/http.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const files = await listZipFiles();
    sendJson(
      res,
      200,
      {
        ok: true,
        packs: files.length,
        repo: `${repoInfo().owner}/${repoInfo().repo}`,
        branch: repoInfo().branch,
        folder: repoInfo().zipsPath,
      },
      "public, s-maxage=60",
    );
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : "GitHub unreachable");
  }
}
