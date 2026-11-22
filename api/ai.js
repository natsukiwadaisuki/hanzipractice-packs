// CIEOS AI proxy.
//
// The app ships with no API key. It calls this endpoint, and this endpoint holds the real provider
// key in an environment variable. That keeps the secret out of the APK, where anyone could read it.
//
// Supported routes:
//   POST /api/ai/v1/chat/completions   streaming or JSON chat, proxied verbatim
//   GET  /api/ai/v1/models             allowlisted model ids
//
// Environment:
//   AI_UPSTREAM_URL  e.g. https://openrouter.ai/api/v1
//   AI_API_KEY       the real upstream key (never sent to the client)
//   AI_MODELS        optional comma-separated allowlist

export const config = { runtime: "edge" };

const UPSTREAM = (process.env.AI_UPSTREAM_URL || "").replace(/\/+$/, "");
const UPSTREAM_KEY = process.env.AI_API_KEY || "";

const ALLOWED_MODELS = (process.env.AI_MODELS || "particle-ai/particle-1:free")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MAX_TOKENS_CAP = 8192;

// Coarse per-instance abuse guard. Serverless instances do not share memory, so this only stops
// obvious hammering from one client; real quota control lives on the upstream account.
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 40;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > WINDOW_LIMIT;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/ai\/?/, "").replace(/\/+$/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization",
      },
    });
  }

  if (!UPSTREAM || !UPSTREAM_KEY) {
    return json(
      {
        error: {
          message: "The CIEOS tutor is not configured on the server yet.",
          type: "server_not_configured",
        },
      },
      503,
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (path.endsWith("models") && request.method === "GET") {
    return json({
      object: "list",
      data: ALLOWED_MODELS.map((id) => ({ id, object: "model", owned_by: "cieos" })),
    });
  }

  if (!path.endsWith("chat/completions")) {
    return json({ error: { message: "Unknown AI route." } }, 404);
  }

  if (request.method !== "POST") {
    return json({ error: { message: "Use POST for chat completions." } }, 405);
  }

  if (rateLimited(ip)) {
    return json({ error: { message: "Too many requests. Wait a moment and try again." } }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: "Arguments were not valid JSON." } }, 400);
  }

  const model = typeof body.model === "string" ? body.model : "";
  if (!ALLOWED_MODELS.includes(model)) {
    return json(
      {
        error: {
          message: `Model '${model}' is not available on the CIEOS tutor.`,
          allowed: ALLOWED_MODELS,
        },
      },
      400,
    );
  }

  // Normalise optional fields so one odd value cannot break the whole request.
  if (typeof body.max_tokens !== "number" || body.max_tokens <= 0) {
    body.max_tokens = 4096;
  } else {
    body.max_tokens = Math.min(body.max_tokens, MAX_TOKENS_CAP);
  }
  delete body.user;

  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${UPSTREAM_KEY}`,
        accept: body.stream ? "text/event-stream" : "application/json",
        // OpenRouter asks for a caller identity; harmless for other compatible providers.
        "http-referer": process.env.AI_APP_URL || "https://hanzipractice.vercel.app",
        "x-title": "CIEOS",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return json(
      { error: { message: `Could not reach the tutor provider. ${error?.message || ""}`.trim() } },
      502,
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    // Pass the status through so the app can distinguish a bad key from a busy server.
    return new Response(detail || JSON.stringify({ error: { message: "Provider error." } }), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  if (body.stream) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
        "access-control-allow-origin": "*",
      },
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
