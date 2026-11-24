const endpoint = "https://indiframe-production-d1-mcp.mukuls2302.workers.dev/mcp";
const bearerToken = process.env.MCP_BEARER_TOKEN;
const databaseId = "8854232a-6e8f-4fe9-849c-5b61dc229602";
if (!bearerToken || bearerToken.length < 32) {
  throw new Error("Missing GitHub Actions secret MCP_BEARER_TOKEN (must match the production MCP Worker's bearer secret).");
}

let requestId = 0;
async function rpc(method, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Production D1 MCP request failed (${response.status}): ${JSON.stringify(payload)}`);
  if (payload.error) throw new Error(`Production D1 MCP error: ${payload.error.message}`);
  if (payload.result?.isError) {
    throw new Error(payload.result.content?.map(item => item.text).join("\n") || "Production D1 MCP tool failed.");
  }
  const text = payload.result?.content?.find(item => item.type === "text")?.text;
  return text ? JSON.parse(text) : payload.result;
}

await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "production-d1-inspector", version: "1.0.0" } });
const schemaResult = await rpc("tools/call", { name: "d1_production_schema", arguments: {} });
const schema = schemaResult.tables || [];
const tables = [];
for (const item of schema.filter(x => x.type === "table")) {
  const name = String(item.name);
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Unexpected table identifier; aborting.");
  const countResult = await rpc("tools/call", {
    name: "d1_production_query",
    arguments: { sql: `SELECT COUNT(*) AS row_count FROM "${name}"`, params: [] }
  });
  const rows = countResult.result?.results || [];
  const foreignKeys = [...(item.sql || "").matchAll(/REFERENCES\s+["\x60]?([A-Za-z0-9_]+)["\x60]?\s*\(([^)]+)\)/gi)]
    .map(match => ({ referencedTable: match[1], referencedColumns: match[2].split(",").map(value => value.trim().replace(/["\x60]/g, "")) }));
  tables.push({
    name,
    rowCount: Number(rows[0]?.row_count ?? 0),
    createSql: item.sql,
    foreignKeys
  });
}
const report = {
  target: "production",
  databaseName: "indiframe-helpdesk-db",
  databaseId,
  previewDatabaseIdTouched: false,
  generatedAt: new Date().toISOString(),
  schemaObjects: schema.filter(x => x.type === "view"),
  tables
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
