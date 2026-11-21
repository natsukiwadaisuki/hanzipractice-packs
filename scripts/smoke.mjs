/**
 * Local smoke test: calls each Vercel handler with a mock req/res and prints results.
 * Usage: node scripts/smoke.mjs
 */
import packs from "../api/packs/index.js";
import readme from "../api/packs/[id]/readme.js";
import download from "../api/packs/[id]/download.js";
import assets from "../api/packs/[id]/assets/[...path].js";
import health from "../api/health.js";

function mockRes() {
  const state = { status: 0, headers: {}, body: null };
  return {
    state,
    setHeader(k, v) { state.headers[k] = v; },
    status(code) { state.status = code; return this; },
    send(body) { state.body = body; return this; },
    end() { return this; },
    json() { return state.body ? JSON.parse(state.body) : null; },
  };
}

async function call(name, handler, query = {}) {
  const req = { method: "GET", query };
  const res = mockRes();
  await handler(req, res);
  const type = res.state.headers["Content-Type"] || "";
  const body = type.includes("json") ? JSON.parse(res.state.body) : res.state.body;
  const size = Buffer.isBuffer(body) ? body.length : (res.state.body || "").length;
  console.log(`${name.padEnd(28)} ${res.state.status}  ${size} bytes`);
  return { status: res.state.status, body, headers: res.state.headers };
}

const h = await call("GET /api/health", health);
if (!h.body.ok) console.log("  health:", h.body);

const list = await call("GET /api/packs", packs);
const packsList = list.body.packs || [];
packsList.forEach((p) => console.log(`  · ${p.id} — ${p.title} (${p.sizeBytes} B)`));

if (packsList.length) {
  const id = packsList[0].id;
  const r = await call(`GET /packs/${id}/readme`, readme, { id });
  console.log("  title:", r.body.title, "| readmePath:", r.body.readmePath);
  console.log("  markdown starts:", (r.body.markdown || "").slice(0, 48).replace(/\n/g, " "));

  const assetMatch = (r.body.markdown || "").match(/!\[[^\]]*]\(\/api\/packs\/[^/]+\/assets\/([^)]+)\)/);
  if (assetMatch) {
    const path = assetMatch[1].split("/");
    const a = await call(`GET /packs/${id}/assets/${path.at(-1)}`, assets, { id, path });
    console.log("  asset type:", a.headers["Content-Type"]);
  }

  const d = await call(`GET /packs/${id}/download`, download, { id });
  console.log("  zip magic:", d.body.slice(0, 2).toString("hex"));
}

const failures = [];
if (h.status !== 200) failures.push("health");
if (list.status !== 200) failures.push("packs");
console.log(failures.length ? `FAIL: ${failures.join(", ")}` : "SMOKE PASS");
process.exit(failures.length ? 1 : 0);
