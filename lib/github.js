const OWNER = process.env.GH_OWNER || "natsukiwadaisuki";
const REPO = process.env.GH_REPO || "hanzipractice-packs";
const BRANCH = process.env.GH_BRANCH || "main";
const ZIPS_PATH = (process.env.GH_ZIPS_PATH || "zips").replace(/^\/+|\/+$/g, "");
const TOKEN = process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com";

const headers = () => {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "HanziPractice-Packs",
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
};

export const repoInfo = () => ({ owner: OWNER, repo: REPO, branch: BRANCH, zipsPath: ZIPS_PATH });

export function rawUrl(fileName) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${ZIPS_PATH}/${encodeURIComponent(fileName)}`;
}

/** Lists .zip files in the configured folder. Returns filename + metadata. */
export async function listZipFiles() {
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${ZIPS_PATH}?ref=${encodeURIComponent(BRANCH)}`;
  const response = await fetch(url, { headers: headers() });
  if (response.status === 404) {
    throw new Error(`Folder '${ZIPS_PATH}' not found in ${OWNER}/${REPO}@${BRANCH}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub listing failed (${response.status})`);
  }
  const items = await response.json();
  if (!Array.isArray(items)) throw new Error("Unexpected GitHub contents response");
  return items
    .filter((item) => item.type === "file" && /\.zip$/i.test(item.name))
    .map((item) => ({
      name: item.name,
      sizeBytes: item.size || 0,
      sha: item.sha,
      downloadUrl: item.download_url || rawUrl(item.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Optional curated metadata: zips/index.json -> { "file.zip": { title, description, level, tags } } */
export async function loadManifest() {
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${ZIPS_PATH}/index.json?ref=${encodeURIComponent(BRANCH)}`;
  try {
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) return {};
    const data = await response.json();
    if (!data.content) return {};
    const text = Buffer.from(data.content, "base64").toString("utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function findZip(fileName) {
  const files = await listZipFiles();
  const match = files.find((file) => file.name === fileName);
  if (!match) return null;
  return match;
}

const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

/** Downloads a zip from GitHub and caches it briefly in the function instance. */
export async function fetchZipBytes(fileName) {
  const key = `${OWNER}/${REPO}@${BRANCH}/${fileName}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.bytes;

  const response = await fetch(rawUrl(fileName), {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${fileName}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 240 * 1024 * 1024) throw new Error("Pack exceeds size limit");
  cache.set(key, { at: now, bytes });
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return bytes;
}
