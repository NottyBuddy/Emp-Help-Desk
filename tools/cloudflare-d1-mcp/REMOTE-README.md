# Remote IndiFrame Production D1 MCP

This is an isolated, authenticated Streamable HTTP-compatible MCP endpoint for ChatGPT and other MCP clients.

## Fixed database scope

- Worker: `indiframe-production-d1-mcp`
- Endpoint path: `/mcp`
- D1 binding: `indiframe-helpdesk-db`
- Production D1 UUID: `8854232a-6e8f-4fe9-849c-5b61dc229602`
- Preview UUID: `abb0abb1-3a62-47e1-a254-c64d48a74602` (not bound to this Worker)
- This config intentionally has no Preview D1 binding.

## Security

- Every request requires a bearer token stored as the Worker secret `MCP_BEARER_TOKEN`.
- The secret must be at least 32 characters.
- No token, Cloudflare account ID or API token is committed to this repository.
- SQL is limited to one statement per tool call.
- Mutations referencing the `agents` account table are blocked.
- `PRAGMA`, `ATTACH`, `DETACH` and `VACUUM` are blocked.
- Only POST requests to `/mcp` are accepted.
- This endpoint can modify production operational data. Review every destructive SQL statement and take a D1 backup before use.

## Deploy

From the repository root, using an authenticated Cloudflare Wrangler CLI session:

```bash
npx wrangler login
npx wrangler secret put MCP_BEARER_TOKEN --config wrangler.mcp.toml
npx wrangler deploy --config wrangler.mcp.toml
```

Generate a random secret of at least 32 characters using a password manager or a secure local generator. Do not paste it into GitHub, this repository, or chat. Set the same secret in the MCP client's Authorization bearer-token field.

After deployment, the endpoint is:

```
https://indiframe-production-d1-mcp.<your-workers-dev-subdomain>.workers.dev/mcp
```

The exact hostname is assigned by Cloudflare during deployment.

## ChatGPT connection

In ChatGPT, open Settings → Apps/Connectors → Advanced settings (wording may vary) → Create connector, then enter the deployed HTTPS MCP URL and configure bearer-token authentication if offered by the UI. Save and enable the connector. If the account's connector UI requires OAuth rather than bearer-token authentication, do not expose this endpoint without adding an OAuth layer first.

## MCP tools

- `d1_production_identity`
- `d1_production_schema`
- `d1_production_query`

The endpoint does not execute SQL during deployment or startup. No production rows are changed by deploying the Worker.
