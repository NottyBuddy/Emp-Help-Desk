// Employee Help Desk — safe API maintenance mode.
// The rebuilt preview is a static, browser-local app. Legacy IndiFrame routes
// are intentionally unreachable until a new authenticated, tenant-safe API is implemented.

const ALLOWED_ORIGINS = new Set([
  "https://nottybuddy.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://nottybuddy.github.io",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(request) }
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(request) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return json(request, {
        ok: true,
        name: "employee-help-desk-api",
        mode: "maintenance",
        message: "The legacy API is disabled while the new secure backend is being built."
      });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json(request, { ok: true, mode: "maintenance", service: "Employee Help Desk API" });
    }

    // Fail closed: no legacy employee, session, attendance, KPI, quiz,
    // helpdesk or weekly-data route can access the old D1 database.
    return json(request, {
      error: "API temporarily unavailable. The Employee Help Desk preview stores data only in this browser."
    }, 410);
  }
};
