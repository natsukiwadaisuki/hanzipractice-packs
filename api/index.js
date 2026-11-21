import { handleOptions, sendError, sendJson } from "../lib/http.js";

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    sendJson(res, 200, {
      name: "HanziPractice course packs",
      version: 1,
      love: "Made with love by HanziPractice team <3",
      endpoints: {
        packs: "/api/packs",
        readme: "/api/packs/{id}/readme",
        assets: "/api/packs/{id}/assets/{path}",
        download: "/api/packs/{id}/download",
        health: "/api/health",
      },
    });
  } catch (error) {
    sendError(res, 500, "Unexpected error");
  }
}
