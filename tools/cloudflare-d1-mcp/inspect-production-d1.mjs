const databaseId = "8854232a-6e8f-4fe9-849c-5b61dc229602";
const databaseName = "indiframe-helpdesk-db";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error("Missing or invalid CLOUDFLARE_ACCOUNT_ID.");
}
if (!apiToken || apiToken.length < 20) {
  throw new Error("Missing CLOUDFLARE_API_TOKEN.");
}

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;

async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) {
    throw new Error(`Cloudflare D1 API failed (${response.status}): ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload;
}

async function query(sql, params = []) {
  const payload = await api("/query", {
    method: "POST",
    body: JSON.stringify({ sql, params })
  });
  const result = payload.result?.[0];
  if (!result?.success) throw new Error(`D1 query failed: ${JSON.stringify(result?.meta || result)}`);
  return result.results || [];
}

// Verify the fixed production database identity before reading any data.
const identity = await api("");
if (identity.result?.uuid !== databaseId || identity.result?.name !== databaseName) {
  throw new Error("Production D1 identity mismatch. Inspection aborted.");
}

const schema = await query(
  "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
);
const tables = [];
for (const item of schema.filter(x => x.type === "table")) {
  const name = String(item.name);
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Unexpected table identifier; aborting.");
  const countRows = await query(`SELECT COUNT(*) AS row_count FROM "${name}"`);
  const foreignKeys = [...(item.sql || "").matchAll(/REFERENCES\s+["\x60]?([A-Za-z0-9_]+)["\x60]?\s*\(([^)]+)\)/gi)]
    .map(match => ({
      referencedTable: match[1],
      referencedColumns: match[2].split(",").map(value => value.trim().replace(/["\x60]/g, ""))
    }));
  tables.push({
    name,
    rowCount: Number(countRows[0]?.row_count ?? 0),
    createSql: item.sql,
    foreignKeys
  });
}

const report = {
  target: "production",
  databaseName,
  databaseId,
  previewDatabaseIdTouched: false,
  generatedAt: new Date().toISOString(),
  schemaObjects: schema.filter(x => x.type === "view"),
  tables
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
