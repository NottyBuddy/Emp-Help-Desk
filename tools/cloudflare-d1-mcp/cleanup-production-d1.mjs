const DATABASE_ID = "8854232a-6e8f-4fe9-849c-5b61dc229602";
const DATABASE_NAME = "indiframe-helpdesk-db";
const EXPECTED_ROWS = {
  weekly_source_rows: 33,
  weekly_source_imports: 1,
  agent_breaks: 9,
  kpi_daily: 0,
  kpi_imports: 0,
  project_activity: 2,
  quiz_questions: 39,
  helpdesk_settings: 2,
  agent_acw_sessions: 0,
  agent_signup_requests: 2,
  call_performance_rows: 0,
  attendance: 8,
  weekly_kpis: 0,
  sessions: 238,
  audit_log: 35,
  call_performance_report_rows: 189,
  agents: 4,
  call_performance_imports: 4,
  project_products: 0,
  projects: 2,
  quiz_attempts: 1
};

// Child tables are emptied before their referenced parent tables.
const DELETE_ORDER = [
  "sessions",
  "agent_breaks",
  "agent_acw_sessions",
  "helpdesk_settings",
  "attendance",
  "kpi_daily",
  "kpi_imports",
  "weekly_kpis",
  "weekly_source_rows",
  "weekly_source_imports",
  "call_performance_rows",
  "call_performance_report_rows",
  "call_performance_imports",
  "project_products",
  "project_activity",
  "projects",
  "quiz_attempts",
  "quiz_questions",
  "audit_log",
  "agent_signup_requests",
  "agents"
];

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("Missing or invalid CLOUDFLARE_ACCOUNT_ID.");
if (!apiToken || apiToken.length < 20) throw new Error("Missing CLOUDFLARE_API_TOKEN.");

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${DATABASE_ID}`;
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
async function query(sql) {
  const payload = await api("/query", { method: "POST", body: JSON.stringify({ sql, params: [] }) });
  const result = payload.result?.[0];
  if (!result?.success) throw new Error(`D1 query failed: ${JSON.stringify(result?.meta || result)}`);
  return result.results || [];
}
async function countRows(table) {
  if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error("Unexpected table name.");
  const rows = await query(`SELECT COUNT(*) AS row_count FROM "${table}"`);
  return Number(rows[0]?.row_count ?? 0);
}

// Verify exact production target and backend before any write.
const identity = await api("");
if (identity.result?.uuid !== DATABASE_ID || identity.result?.name !== DATABASE_NAME || identity.result?.version !== "production") {
  throw new Error("Production database identity/version mismatch. Cleanup aborted.");
}

const objects = await query("PRAGMA table_list");
const existing = new Set(objects
  .filter(item => item.schema === "main" && item.type === "table" && !String(item.name).startsWith("sqlite_") && item.name !== "_cf_KV")
  .map(item => item.name));
for (const table of Object.keys(EXPECTED_ROWS)) {
  if (!existing.has(table)) throw new Error(`Expected table missing: ${table}. Cleanup aborted.`);
}

const before = {};
for (const [table, expected] of Object.entries(EXPECTED_ROWS)) {
  const actual = await countRows(table);
  before[table] = actual;
  if (actual !== expected) {
    throw new Error(`Row count changed for ${table}: expected ${expected}, found ${actual}. Cleanup aborted without deleting data.`);
  }
}

const batch = DELETE_ORDER.map(table => ({ sql: `DELETE FROM "${table}"`, params: [] }));
const deletion = await api("/query", {
  method: "POST",
  body: JSON.stringify({ batch })
});
const results = deletion.result || [];
if (results.length !== DELETE_ORDER.length || results.some(result => result.success !== true)) {
  throw new Error("D1 did not confirm every deletion statement. Check the database before retrying.");
}

const after = {};
for (const table of Object.keys(EXPECTED_ROWS)) {
  after[table] = await countRows(table);
  if (after[table] !== 0) throw new Error(`Post-cleanup verification failed for ${table}: ${after[table]} rows remain.`);
}

const report = {
  target: "production",
  databaseName: DATABASE_NAME,
  databaseId: DATABASE_ID,
  databaseVersion: identity.result.version,
  previewDatabaseIdTouched: false,
  operation: "clear all rows from the existing application tables; preserve schema",
  tablesCleared: DELETE_ORDER,
  rowsBefore: before,
  rowsAfter: after,
  totalRowsCleared: Object.values(before).reduce((sum, count) => sum + count, 0),
  verifiedAt: new Date().toISOString(),
  schemaPreserved: true
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
