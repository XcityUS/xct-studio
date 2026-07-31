var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var JSON_HEADERS = { "Content-Type": "application/json" };
function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && (allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin));
  if (!ok) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
__name(json, "json");
async function resolveOwner(bearer, env) {
  const base = (env.LITELLM_BASE_URL || "").replace(/\/+$/, "");
  const res = await fetch(`${base}/key/info`, {
    headers: { Authorization: `Bearer ${bearer}` }
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  const userId = body?.info?.user_id;
  if (userId) return `u/${userId}`;
  return `k/${await sha256Hex(bearer)}`;
}
__name(resolveOwner, "resolveOwner");
async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
__name(sha256Hex, "sha256Hex");
function safeVideoId(id) {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
}
__name(safeVideoId, "safeVideoId");
var UPLOAD_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};
async function handleUpload(request, env, cors) {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) {
    return json({ error: "missing bearer token" }, 401, cors);
  }
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = UPLOAD_TYPES[contentType];
  if (!ext) {
    return json({ error: `unsupported content-type (want one of: ${Object.keys(UPLOAD_TYPES).join(", ")})` }, 415, cors);
  }
  const body = await request.arrayBuffer();
  const maxUpload = Number(env.MAX_UPLOAD_BYTES || 0) || 10485760;
  if (body.byteLength === 0) {
    return json({ error: "empty body" }, 400, cors);
  }
  if (body.byteLength > maxUpload) {
    return json({ error: `image is ${body.byteLength} bytes, over the ${maxUpload} limit` }, 413, cors);
  }
  const owner = await resolveOwner(bearer, env);
  if (!owner) {
    return json({ error: "invalid or unauthorized key" }, 403, cors);
  }
  const hash = await sha256Hex(body);
  const key = `${owner}/refs/${hash}.${ext}`;
  const publicUrl = `${new URL(request.url).origin}/media/${key}`;
  const existing = await env.XCITY_MEDIA.head(key);
  if (existing) {
    return json({ url: publicUrl, key, bytes: existing.size, cached: true }, 200, cors);
  }
  await env.XCITY_MEDIA.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });
  return json({ url: publicUrl, key, bytes: body.byteLength, cached: false }, 200, cors);
}
__name(handleUpload, "handleUpload");
async function handleArchive(request, env, cors) {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) {
    return json({ error: "missing bearer token" }, 401, cors);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400, cors);
  }
  const videoId = safeVideoId(payload?.video_id || "");
  const sourceUrl = payload?.source_url;
  if (!videoId || !sourceUrl) {
    return json({ error: "video_id and source_url are required" }, 400, cors);
  }
  let source;
  try {
    source = new URL(sourceUrl);
  } catch {
    return json({ error: "source_url is not a valid URL" }, 400, cors);
  }
  if (source.protocol !== "https:" || !/(^|\.)volces\.com$/.test(source.hostname)) {
    return json({ error: "source_url host is not allowed" }, 400, cors);
  }
  const owner = await resolveOwner(bearer, env);
  if (!owner) {
    return json({ error: "invalid or unauthorized key" }, 403, cors);
  }
  const key = `${owner}/${videoId}.mp4`;
  const existing = await env.XCITY_MEDIA.head(key);
  if (existing) {
    return json(
      { url: `${new URL(request.url).origin}/media/${key}`, key, bytes: existing.size, cached: true },
      200,
      cors
    );
  }
  const upstream = await fetch(source.toString());
  if (!upstream.ok || !upstream.body) {
    return json({ error: `source fetch failed (${upstream.status})` }, 502, cors);
  }
  const declared = Number(upstream.headers.get("content-length") || 0);
  const maxBytes = Number(env.MAX_BYTES || 0) || 209715200;
  if (declared && declared > maxBytes) {
    return json({ error: `source is ${declared} bytes, over the ${maxBytes} limit` }, 413, cors);
  }
  const stored = await env.XCITY_MEDIA.put(key, upstream.body, {
    httpMetadata: {
      contentType: upstream.headers.get("content-type") || "video/mp4",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });
  return json(
    { url: `${new URL(request.url).origin}/media/${key}`, key, bytes: stored?.size ?? declared ?? null, cached: false },
    200,
    cors
  );
}
__name(handleArchive, "handleArchive");
async function handleMedia(request, env, key, cors) {
  if (!key) return new Response("Not Found", { status: 404, headers: cors });
  const range = request.headers.get("range");
  const object = await env.XCITY_MEDIA.get(key, range ? { range: request.headers } : void 0);
  if (!object) return new Response("Not Found", { status: 404, headers: cors });
  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!headers.has("Access-Control-Allow-Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
  }
  if (object.range && object.size != null) {
    const start = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - start;
    headers.set("Content-Range", `bytes ${start}-${start + length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}
__name(handleMedia, "handleMedia");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
    }
    if (url.pathname === "/archive" && request.method === "POST") {
      return handleArchive(request, env, cors);
    }
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request, env, cors);
    }
    if (url.pathname.startsWith("/media/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: cors });
      }
      return handleMedia(request, env, decodeURIComponent(url.pathname.slice("/media/".length)), cors);
    }
    if (url.pathname === "/health") {
      return json({ ok: true }, 200, cors);
    }
    return new Response("Not Found", { status: 404, headers: cors });
  }
};

// ../../../../../../.nvm/versions/node/v20.11.1/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../.nvm/versions/node/v20.11.1/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-MH8it0/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../../../../../.nvm/versions/node/v20.11.1/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-MH8it0/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
