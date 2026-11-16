# IndiFrame Cloudflare D1 MCP connector

This local MCP server exposes a narrowly scoped SQL interface to the **production** Cloudflare D1 database configured for IndiFrame Help Desk.

## Safety boundaries

- Production D1 UUID is hard-coded: `8854232a-6e8f-4fe9-849c-5b61dc229602`.
- Preview D1 UUID is explicitly recorded and is never used: `abb0abb1-3a62-47e1-a254-c64d48a74602`.
- Before every tool call, the server fetches the Cloudflare database metadata and verifies both the UUID and database name (`indiframe-helpdesk-db`).
- The `agents` account table is protected against UPDATE, DELETE, INSERT, REPLACE, DROP and ALTER statements.
- Exactly one SQL statement is accepted per call.
- No API token or account ID is stored in this repository.
- This connector is destructive-capable for other tables. Review SQL and take a D1 backup before any cleanup.

## Requirements

- Node.js 18 or newer.
- A Cloudflare API token with D1 Read and D1 Write permissions scoped to the correct account.
- The Cloudflare account ID.

## Setup

From the repository root:

```bash
npm install
```

Set these environment variables in your local shell or secret manager (do not commit them):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Run:

```bash
npm run mcp:d1
```

The server communicates over MCP stdio. Add it to an MCP-capable client using the command `node`, arguments `tools/cloudflare-d1-mcp/server.mjs`, and the two environment variables above.

Example client configuration:

```json
{
  "mcpServers": {
    "indiframe-production-d1": {
      "command": "node",
      "args": ["ABSOLUTE_REPOSITORY_PATH/tools/cloudflare-d1-mcp/server.mjs"],
      "env": {
        "CLOUDFLARE_ACCOUNT_ID": "YOUR_CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN": "YOUR_SCOPED_API_TOKEN"
      }
    }
  }
}
```

## Exposed tools

- `d1_production_identity`: verify the fixed production database target.
- `d1_production_schema`: inspect tables and views.
- `d1_production_query`: run one SQL statement with optional positional parameters.

This repository change does **not** automatically register a new tool in the current ChatGPT session. After the MCP server is run and connected in the MCP client settings, its tools become available there. No production data is changed by installing or starting this connector.
