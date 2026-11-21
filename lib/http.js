export function setCommonHeaders(res, { cache = "no-store" } = {}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", cache);
}

export function sendJson(res, status, body, cache = "no-store") {
  setCommonHeaders(res, { cache });
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body, null, 2));
}

export function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { error: message, ...extra });
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCommonHeaders(res);
    res.status(204).end();
    return true;
  }
  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed. This API is read-only.");
    return true;
  }
  return false;
}

/** Path params can arrive as string | string[] depending on the route shape. */
export function param(value) {
  if (Array.isArray(value)) return value.map(decodeURIComponent).join("/");
  return value ? decodeURIComponent(value) : "";
}
