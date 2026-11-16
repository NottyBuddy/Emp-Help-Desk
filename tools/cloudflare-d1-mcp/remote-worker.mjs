const PRODUCTION_DATABASE_ID = "8854232a-6e8f-4fe9-849c-5b61dc229602";
const PRODUCTION_DATABASE_NAME = "indiframe-helpdesk-db";
const PREVIEW_DATABASE_ID = "abb0abb1-3a62-47e1-a254-c64d48a74602";
const PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  {
    name: "d1_production_identity",
    description: "Verify the fixed production D1 target configured in this isolated Worker. Read-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "d1_production_schema",
    description: "List production D1 tables and views with their CREATE SQL. Read-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "d1_production_query",
    description: "Execute exactly one SQL statement against the fixed production D1 binding. Use ? placeholders and params. Mutations referencing the agents account table are blocked. Preview D1 is not bound to this Worker.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", minLength: 1 },
        params: { type: "array", items: { type: ["string", "number", "boolean", "null"] } }
      },
      required: ["sql"],
      additionalProperties: false
    }
  }
];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders }
  });
}

async function authorized(request, secret) {
  if (typeof secret !== "string" || secret.length < 32) return false;
  const match = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const encoder = new TextEncoder();
  const [provided, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(match[1])),
    crypto.subtle.digest("SHA-256", encoder.encode(secret))
  ]);
  const a = new Uint8Array(provided), b = new Uint8Array(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function singleStatement(sql) {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("SQL must be a non-empty string.");
  const s = sql.trim();
  let quote = null, lineComment = false, blockComment = false, semicolon = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (c === quote) {
        if (s[i + 1] === quote) { i++; continue; }
        quote = null;
      } else if (c === "\\" && quote !== "]") i++;
      continue;
    }
    if (c === "-" && n === "-") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === ";") {
      if (semicolon !== -1 || s.slice(i + 1).replace(/(?:--[^\n]*|\/\*[\s\S]*?\*\/)/g, "").trim()) {
        throw new Error("Only one SQL statement is allowed per call.");
      }
      semicolon = i;
    }
  }
  if (quote || blockComment) throw new Error("SQL contains an unterminated quote or comment.");
  return semicolon === -1 ? s : s.slice(0, semicolon).trim();
}

function enforceSqlSafety(sql) {
  const normalized = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
  if (/\b(PRAGMA|ATTACH|DETACH|VACUUM)\b/i.test(normalized)) {
    throw new Error("PRAGMA, ATTACH, DETACH and VACUUM operations are blocked.");
  }
  const mutating = /\b(INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|CREATE)\b/i.test(normalized);
  if (mutating && /\bagents\b/i.test(normalized)) {
    throw new Error("Safety policy: mutations referencing the agents account table are blocked.");
  }
  if (/\b(load_extension|writable_schema)\b/i.test(normalized)) {
    throw new Error("This SQL operation is blocked by the safety policy.");
  }
}

async function runTool(name, args, env) {
  if (name === "d1_production_identity") {
    return {
      target: "production",
      databaseName: PRODUCTION_DATABASE_NAME,
      databaseId: PRODUCTION_DATABASE_ID,
      previewDatabaseIdNotBound: PREVIEW_DATABASE_ID
    };
  }
  if (name === "d1_production_schema") {
    const result = await env.DB.prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
    ).all();
    return { target: "production", tables: result.results || [] };
  }
  if (name === "d1_production_query") {
    const sql = singleStatement(args?.sql);
    enforceSqlSafety(sql);
    const params = Array.isArray(args?.params) ? args.params.map(value => {
      if (value === null) return null;
      if (typeof value === "boolean") return value ? 1 : 0;
      if (typeof value === "string" || typeof value === "number") return value;
      throw new Error("SQL parameters must be strings, numbers, booleans or null.");
    }) : [];
    const statement = env.DB.prepare(sql);
    const result = params.length ? statement.bind(...params) : statement;
    const isRead = /^\s*(SELECT|WITH\s+[^;]*?\bSELECT)\b/i.test(sql);
    const output = isRead ? await result.all() : await result.run();
    return { target: "production", result: output };
  }
  throw new Error("Unknown tool: " + name);
}

function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

async function handleRpc(message, env) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "Invalid Request");
  }
  const hasId = Object.prototype.hasOwnProperty.call(message, "id");
  if (message.method === "notifications/initialized" || message.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
  if (!hasId) return new Response(null, { status: 202 });
  if (message.method === "initialize") {
    const requested = message.params?.protocolVersion;
    const version = requested === "2025-03-26" || requested === "2024-11-05" ? requested : PROTOCOL_VERSION;
    return json({
      jsonrpc: "2.0", id: message.id,
      result: {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "indiframe-production-d1", version: "1.0.0" },
        instructions: "This endpoint is fixed to the IndiFrame production D1 binding. Preview D1 is not bound. Mutations to the agents account table are blocked."
      }
    });
  }
  if (message.method === "ping") return json({ jsonrpc: "2.0", id: message.id, result: {} });
  if (message.method === "tools/list") {
    return json({ jsonrpc: "2.0", id: message.id, result: { tools: TOOLS } });
  }
  if (message.method === "tools/call") {
    try {
      const result = await runTool(message.params?.name, message.params?.arguments || {}, env);
      return json({
        jsonrpc: "2.0", id: message.id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
      });
    } catch (error) {
      return json({
        jsonrpc: "2.0", id: message.id,
        result: { isError: true, content: [{ type: "text", text: error?.message || String(error) }] }
      });
    }
  }
  return rpcError(message.id, -32601, "Method not found");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/mcp") return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return new Response("Method not allowed", {
      status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" }
    });
    if (!await authorized(request, env.MCP_BEARER_TOKEN)) return json({ error: "Unauthorized" }, 401);
    const accept = request.headers.get("Accept") || "";
    if (!accept.includes("application/json") && !accept.includes("text/event-stream")) {
      return json({ error: "Accept must include application/json or text/event-stream" }, 406);
    }
    let message;
    try { message = await request.json(); }
    catch { return rpcError(null, -32700, "Parse error"); }
    if (Array.isArray(message)) return rpcError(null, -32600, "Batch requests are not supported");
    return handleRpc(message, env);
  }
};
