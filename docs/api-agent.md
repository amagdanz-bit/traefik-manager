# Agent API Reference

The Traefik Manager Agent (TMA) exposes an HTTP API on port 8090. All endpoints except `/health` require authentication.

## Authentication

Include your API key in every request using the `X-Api-Key` header:

```http
X-Api-Key: your-api-key-here
```

Alternatively, use the `Authorization: Bearer <key>` header.

TM handles authentication automatically when proxying calls through `/api/agents/proxy/<id>/...`.

## Rate limiting

Requests are rate-limited per IP using `TMA_RATE_LIMIT` (default: 10 requests/minute). Returns `429 Too Many Requests` when exceeded. Set `TMA_RATE_LIMIT=0` to disable. Increase it if a single TM instance needs to make frequent calls.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check - no auth required |
| GET | `/api/traefik/overview` | Traefik API overview |
| GET | `/api/traefik/routers` | HTTP routers |
| GET | `/api/traefik/services` | HTTP services |
| GET | `/api/traefik/middlewares` | Middlewares |
| GET | `/api/traefik/entrypoints` | Entrypoints |
| GET | `/api/traefik/version` | Traefik version |
| GET | `/api/traefik/certs` | Certificate info (requires `ACME_JSON_PATH`) |
| GET | `/api/traefik/logs` | Access log tail (requires `ACCESS_LOG_PATH`) |
| GET | `/api/configs` | Read dynamic config file(s) |
| POST | `/api/configs` | Write dynamic config file(s) |
| GET | `/api/static` | Read static config (requires `STATIC_CONFIG_PATH`) |
| POST | `/api/static` | Write static config |
| GET | `/api/static/status` | Restart method info |
| POST | `/api/static/restart` | Restart Traefik (requires `RESTART_METHOD`) |
| GET | `/api/crowdsec/decisions` | CrowdSec active decisions (requires CrowdSec config) |
| GET | `/api/crowdsec/alerts` | CrowdSec recent alerts |
| DELETE | `/api/crowdsec/decisions/<id>` | Unban an IP |
| GET | `/api/backups` | List local backup files |
| POST | `/api/backup/create` | Create a local backup zip |
| POST | `/api/restore/<filename>` | Restore from a local backup |
| GET | `/api/backup/git/status` | Git backup status |
| POST | `/api/backup/git/push` | Manual git push |
| POST | `/api/backup/git/test` | Test git connectivity |
| GET | `/api/backup/git/commits` | Last 50 commits |
| GET | `/api/backup/git/commit/<sha>/diff` | Per-file diff for a commit |
| POST | `/api/backup/git/restore/<sha>` | Restore configs from a git commit |
| DELETE | `/api/backup/git/repo` | Reset (delete) local git repo clone |

## Health check

```http
GET /health
```

Response (no auth required):
```json
{"ok": true, "version": "1.5.0"}
```

## Error responses

| Status | Meaning |
|---|---|
| 401 | Missing or invalid API key |
| 404 | Endpoint not available (e.g. `STATIC_CONFIG_PATH` not set) |
| 429 | Rate limit exceeded |
| 500 | Internal error |
| 502 | Cannot reach Traefik (for proxy endpoints) |

All errors return `{"error": "message"}`.

## Proxying through TM

TM proxies agent calls server-side via `/api/agents/proxy/<agent-id>/<path>`. For example:

```
GET /api/agents/proxy/abc123/traefik/routers
```

Routes to:
```
GET https://agent-host:8090/api/traefik/routers
```

TM injects the `X-Api-Key` header automatically using the stored (encrypted) key.
