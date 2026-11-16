import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const PRODUCTION_DATABASE_ID = "8854232a-6e8f-4fe9-849c-5b61dc229602";
const PREVIEW_DATABASE_ID = "abb0abb1-3a62-47e1-a254-c64d48a74602";
const PRODUCTION_DATABASE_NAME = "indiframe-helpdesk-db";

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN.");
  process.exit(1);
}
if (PRODUCTION_DATABASE_ID === PREVIEW_DATABASE_ID) {
  console.error("Safety check failed: production and preview database IDs match.");
  process.exit(1);
}

const apiBase = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${PRODUCTION_DATABASE_ID}`;

async function cloudflare(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) {
    const detail = (payload.errors || []).map((e) => e.message).join("; ");
    throw new Error(`Cloudflare D1 API error (${response.status}): ${detail || "request failed"}`);
  }
  return payload.result;
}

async function verifyProductionTarget() {
  const db = await cloudflare("");
  if (db?.uuid !== PRODUCTION_DATABASE_ID || db?.name !== PRODUCTION_DATABASE_NAME) {
    throw new Error("Refusing operation: Cloudflare database identity does not match the configured production D1 database.");
  }
  return { name: db.name, uuid: db.uuid };
}

function assertSingleStatement(sql) {
  const s = sql.trim();
  if (!s) throw new Error("SQL cannot be empty.");
  // Reject semicolons outside quoted strings/comments; this MCP executes one statement per call.
  let quote = null, lineComment = false, blockComment = false;
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
      if (s.slice(i + 1).trim()) throw new Error("Only one SQL statement is allowed per call.");
    }
  }
  if (quote || blockComment) throw new Error("SQL contains an unterminated quote or comment.");
  return s.replace(/;\s*$/, "");
}

function protectAccounts(sql) {
  const normalized = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
  const table = '(?:(?:main|temp)\\s*\\.\\s*)?["'`]?agents["'`]?';
  const mutations = [
    new RegExp('\\bDELETE\\s+FROM\\s+' + table + '\\b', 'i'),
    new RegExp('\\bUPDATE(?:\\s+OR\\s+(?:ROLLBACK|ABORT|REPLACE|FAIL|IGNORE))?\\s+' + table + '\\b', 'i'),
    new RegExp('\\b(?:INSERT|REPLACE)\\s+(?:OR\\s+(?:ROLLBACK|ABORT|REPLACE|FAIL|IGNORE)\\s+)?INTO\\s+' + table + '\\b', 'i'),
    new RegExp('\\b(?:DROP|ALTER)\\s+TABLE\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?' + table + '\\b', 'i'),
    new RegExp('\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b[\\s\\S]*?\\bON\\s+' + table + '\\b', 'i'),
    new RegExp('\\bCREATE\\s+TRIGGER\\b[\\s\\S]*?\\bON\\s+' + table + '\\b', 'i')
  ];
  if (mutations.some((pattern) => pattern.test(normalized))) {
    throw new Error("Safety policy: the agents account table is protected. Account records and password hashes cannot be changed or deleted through this connector.");
  }
  if (/\\b(PRAGMA|DROP\\s+DATABASE|ATTACH\\s+DATABASE|DETACH\\s+DATABASE|VACUUM\\s+INTO)\\b/i.test(normalized)) {
    throw new Error("This database-level operation is blocked by the connector safety policy.");
  }
}

const server = new Server(
  { name: "indiframe-cloudflare-d1", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "d1_production_identity",
      description: "Verify the Cloudflare D1 database identity. Read-only; fixed to IndiFrame production D1.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    {
      name: "d1_production_schema",
      description: "List production D1 tables and views with their CREATE SQL. Read-only; never accesses Preview.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    {
      name: "d1_production_query",
      description: "Execute exactly one SQL statement against the fixed IndiFrame production D1 database. Supports SELECT and controlled DDL/DML. Parameter values must be supplied separately. The agents account table is protected; sessions may be cleared to force re-login.",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", minLength: 1, description: "Exactly one SQL statement; use ? placeholders." },
          params: { type: "array", items: { type: ["string", "number"] }, description: "Optional positional values for ? placeholders." }
        },
        required: ["sql"],
        additionalProperties: false
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const name = request.params.name;
    const args = request.params.arguments || {};
    const identity = await verifyProductionTarget();

    if (name === "d1_production_identity") {
      return { content: [{ type: "text", text: JSON.stringify({ target: "production", ...identity, previewDatabaseIdBlocked: PREVIEW_DATABASE_ID }, null, 2) }] };
    }

    if (name === "d1_production_schema") {
      const result = await cloudflare("/query", {
        method: "POST",
        body: JSON.stringify({
          sql: "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
        })
      });
      return { content: [{ type: "text", text: JSON.stringify({ target: identity, tables: result?.[0]?.results || [] }, null, 2) }] };
    }

    if (name === "d1_production_query") {
      if (typeof args.sql !== "string") throw new Error("sql must be a string.");
      const sql = assertSingleStatement(args.sql);
      protectAccounts(sql);
      const params = Array.isArray(args.params) ? args.params.map((v) => String(v)) : [];
      const result = await cloudflare("/query", {
        method: "POST",
        body: JSON.stringify({ sql, params })
      });
      return { content: [{ type: "text", text: JSON.stringify({ target: identity, result }, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: error.message || String(error) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
