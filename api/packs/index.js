import { listZipFiles, loadManifest, repoInfo } from "../../lib/github.js";
import { handleOptions, sendError, sendJson } from "../../lib/http.js";

function prettify(name) {
  return name
    .replace(/\.zip$/i, "")
    .replace(/^\d+[-_. ]+/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const [files, manifest] = await Promise.all([listZipFiles(), loadManifest()]);
    const packs = files.map((file) => {
      const meta = manifest[file.name] || {};
      const id = file.name;
      return {
        id,
        title: meta.title || prettify(file.name),
        description: meta.description || "",
        level: meta.level || "",
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        language: meta.language || "",
        sizeBytes: file.sizeBytes,
        updatedAt: meta.updatedAt || null,
        readmeUrl: `/api/packs/${encodeURIComponent(id)}/readme`,
        downloadUrl: `/api/packs/${encodeURIComponent(id)}/download`,
        assetsBase: `/api/packs/${encodeURIComponent(id)}/assets`,
        downloadSource: file.downloadUrl,
      };
    });
    sendJson(
      res,
      200,
      {
        packs,
        count: packs.length,
        repo: repoInfo(),
        love: "Made with love by HanziPractice team <3",
      },
      "public, s-maxage=300, stale-while-revalidate=3600",
    );
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : "Unable to reach GitHub");
  }
}
