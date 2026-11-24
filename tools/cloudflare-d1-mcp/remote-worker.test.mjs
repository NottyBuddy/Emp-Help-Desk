import worker from "./remote-worker.mjs";
import assert from "node:assert/strict";

const SECRET = "test-secret-that-is-long-enough-for-mcp";
let calls = [];
const db = {
  prepare(sql) {
    const call = { sql, params: [] };
    calls.push(call);
    return {
      bind(...params) { call.params = params; return this; },
      async all() {
        if (sql === "PRAGMA table_list") return { success: true, results: [
          { schema: "main", name: "example", type: "table" },
          { schema: "main", name: "sqlite_sequence", type: "table" }
        ] };
        if (sql === 'PRAGMA table_info("example")') return { success: true, results: [
          { cid: 0, name: "id", type: "INTEGER", notnull: 0, dflt_value: null, pk: 1 }
        ] };
        return { success: true, results: [{ name: "example" }] };
      },
      async run() { return { success: true, meta: { changes: 1 } }; }
    };
  }
};
const env = { DB: db, MCP_BEARER_TOKEN: SECRET };
const request = (body, options = {}) => new Request("https://example.workers.dev/mcp", {
  method: "POST",
  headers: {
    Authorization: options.auth === false ? "" : "Bearer " + SECRET,
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});
async function rpc(body, options) {
  const response = await worker.fetch(request(body, options), env);
  const payload = response.status === 202 || response.status === 204 ? null : await response.json();
  return { response, payload };
}

const unauthorized = await worker.fetch(request({ jsonrpc: "2.0", id: 1, method: "initialize" }, { auth: false }), env);
assert.equal(unauthorized.status, 401, "reject requests without bearer auth");

const initialized = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
assert.equal(initialized.response.status, 200);
assert.equal(initialized.payload.result.protocolVersion, "2025-03-26");

const listed = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
assert.deepEqual(listed.payload.result.tools.map(tool => tool.name), [
  "d1_production_identity", "d1_production_schema", "d1_production_query"
]);

const identity = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "d1_production_identity" } });
assert.match(identity.payload.result.content[0].text, /8854232a-6e8f-4fe9-849c-5b61dc229602/);

const schema = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "d1_production_schema" } });
assert.match(schema.payload.result.content[0].text, /example/);
assert.match(schema.payload.result.content[0].text, /"columns"/);
assert.doesNotMatch(schema.payload.result.content[0].text, /sqlite_sequence/);
assert.ok(calls.some(call => call.sql === "PRAGMA table_list"));
assert.ok(calls.some(call => call.sql === 'PRAGMA table_info("example")'));

const select = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: {
  name: "d1_production_query", arguments: { sql: "SELECT * FROM sample WHERE id = ?", params: [7] }
} });
assert.equal(select.payload.result.isError, undefined);
assert.deepEqual(calls.at(-1).params, [7]);

const beforeBlocked = calls.length;
const protectedMutation = await rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: {
  name: "d1_production_query", arguments: { sql: "DELETE FROM agents" }
} });
assert.equal(protectedMutation.payload.result.isError, true);
assert.equal(calls.length, beforeBlocked, "blocked account mutation must not reach D1");

const blockedPragma = await rpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {
  name: "d1_production_query", arguments: { sql: "PRAGMA table_info(agents)" }
} });
assert.equal(blockedPragma.payload.result.isError, true);

const multiStatement = await rpc({ jsonrpc: "2.0", id: 8, method: "tools/call", params: {
  name: "d1_production_query", arguments: { sql: "DELETE FROM tickets; DELETE FROM agents" }
} });
assert.equal(multiStatement.payload.result.isError, true);
assert.equal(calls.length, beforeBlocked, "invalid statements must not reach D1");

const mutation = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/call", params: {
  name: "d1_production_query", arguments: { sql: "DELETE FROM tickets WHERE status = ?", params: ["closed"] }
} });
assert.equal(mutation.payload.result.isError, undefined);
assert.equal(calls.at(-1).params[0], "closed");

console.log("Remote production D1 MCP tests: 9 checks passed");
