const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = "8854232a-6e8f-4fe9-849c-5b61dc229602";
if (!accountId || !apiToken) throw new Error("Missing Cloudflare GitHub Actions credentials.");

async function query(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params })
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(`Cloudflare D1 query failed (${response.status}): ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.result?.[0]?.results || [];
}

const schema = await query("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
const tables = [];
for (const item of schema.filter(x => x.type === "table")) {
  const name = String(item.name);
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Unexpected table identifier; aborting.");
  const countRows = await query(`SELECT COUNT(*) AS row_count FROM "${name}"`);
  const foreignKeys = await query(`PRAGMA foreign_key_list("${name}")`);
  tables.push({ name, rowCount: Number(countRows[0]?.row_count ?? 0), createSql: item.sql, foreignKeys });
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
