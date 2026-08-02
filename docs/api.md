# API Reference

Traefik Manager exposes a REST API used by the web UI and official mobile app.

::: tip Interactive reference
Every TM instance has a built-in API reference with live **Try It** support at `/api` (or click **API** in the navbar). Requests are sent to your own instance with your session already authenticated - no extra setup needed.
:::

---

## Authentication

**API key** *(recommended)* - generate a key in **Settings → Authentication → API Keys** and pass it as a header. API keys bypass CSRF checks entirely.

```
X-Api-Key: your-api-key
```

**Session cookie** - log in via the web UI. The browser session cookie is used automatically.

---

## Response format

All endpoints return JSON.

| Outcome | Shape |
|---|---|
| Success | `{ "ok": true }` or `{ "success": true }` |
| Error | `{ "ok": false, "message": "..." }` or `{ "error": "..." }` |

State-changing endpoints (POST / DELETE) require an `X-CSRF-Token` header when using session auth. API key requests skip this.

## Caching

Responses are sent with `Cache-Control: no-store, no-cache, must-revalidate` by default. Without it, browsers applied heuristic freshness to API responses and to the app shell, which could serve stale data until a hard reload.

Two kinds of response keep their own caching: anything under `/static/`, and any endpoint that sets `Cache-Control` itself. `GET /api/dashboard/icon/<slug>` is the latter - it serves cached app icons with `max-age=86400` so they are not refetched on every dashboard render.

---

## Routes & Middlewares

### `GET /api/routes`

Get all managed routes and middlewares from all loaded config files.

**Response**

```json
{
  "apps": [ /* Route[] */ ],
  "middlewares": [ /* Middleware[] */ ]
}
```

When multiple config files are loaded, route `id` is prefixed as `configFile::name`. Strip the prefix before using the name as a YAML key.

**Route object**

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `name` | string | Router/service name |
| `enabled` | boolean | |
| `protocol` | string | `http`, `tcp`, or `udp` |
| `rule` | string | Traefik rule expression |
| `target` | string | First backend. Kept for backwards compatibility; same as `servers[0]` |
| `servers` | string[] | All backends. URLs for HTTP, `host:port` for TCP and UDP |
| `sticky` | object | `loadBalancer.sticky.cookie`, or `{}` when off. HTTP only |
| `stickyEnabled` | boolean | Whether a sticky block is present. HTTP only |
| `healthCheck` | object | `loadBalancer.healthCheck`, or `{}` when unset. HTTP only |
| `priority` | integer \| null | Router priority, `null` when unset. HTTP and TCP only |
| `middlewares` | string[] | Applied middleware names |
| `tls` | boolean | |
| `certResolver` | string | ACME resolver name, or empty for external certs |
| `configFile` | string | Source config file |

---

### `GET /api/routes/all`

Same shape as `GET /api/routes`, but nothing is filtered out: routes discovered from other Traefik providers (Docker, Kubernetes, and the rest) are enriched from the live Traefik API, and Traefik's own `@internal` routers are included.

```json
{
  "apps": [ /* Route[] */ ],
  "middlewares": [ /* Middleware[] */ ]
}
```

Use this when you want a complete picture of everything Traefik is serving. Use `/api/routes` when you only want the routes this instance manages in its own dynamic config files. Unlike `/api/routes`, this endpoint does not return `configErrors`.

---

### `POST /save`

Create or update a route. Accepts `application/x-www-form-urlencoded`.

| Field | Type | Description |
|---|---|---|
| `serviceName` | string | Route name |
| `subdomain` | string | Hostname (e.g. `app.example.com`) |
| `targetIp` | string | Backend host. Ignored when the matching `backendsJson*` field is sent |
| `serviceRef` | string | Reference an existing service instead of creating `<name>-service`. Writes only the router; all target and load-balancing fields are ignored. A bare name must exist in the file config for that protocol (400 otherwise); a provider-qualified name (`svc@docker`) is written verbatim |
| `targetPort` | string | Backend port |
| `backendsJsonHttp` | string (JSON) | HTTP service definition - see [Multiple backends](#multiple-backends) below |
| `backendsJsonTcp` | string (JSON) | TCP service definition |
| `backendsJsonUdp` | string (JSON) | UDP service definition |
| `protocol` | string | `http`, `tcp`, or `udp` |
| `middlewares` | string | Comma-separated middleware names |
| `scheme` | string | `http` or `https` (default: `http`) |
| `passHostHeader` | boolean | Default: `true` |
| `certResolver` | string | ACME resolver name. Use `none` to write `tls: {}` with no resolver (external certs). |
| `tlsWildcardMain` | string | Main domain for `tls.domains` (e.g. `example.com`). Use with DNS challenge resolvers for wildcard certs. |
| `tlsWildcardSans` | string | Newline-separated SANs for `tls.domains` (e.g. `*.example.com`). |
| `configFile` | string | Target config file (multi-config only) |
| `isEdit` | boolean | `true` when updating an existing route |
| `originalId` | string | Original route ID when renaming |

#### Multiple backends

A service can point at several servers. Send the `backendsJson*` field matching the protocol; it takes precedence over `targetIp`/`targetPort`, which stay supported for single-backend clients.

```json
{
  "servers": [
    { "scheme": "http", "host": "192.168.1.10", "port": "8080" },
    { "scheme": "http", "host": "192.168.1.11", "port": "8080" }
  ],
  "sticky":      { "enabled": true, "cookieName": "tm_sticky", "secure": true, "httpOnly": true },
  "healthCheck": { "enabled": true, "path": "/health", "interval": "10s", "timeout": "3s" },
  "priority": 10
}
```

- A `host` already starting with `http://` or `https://` is used verbatim; otherwise `scheme://host:port` is built.
- Rows with an empty `host` are skipped. Invalid JSON falls back to `targetIp`/`targetPort` rather than failing the save.
- `interval` and `timeout` take Go durations (`10s`, `1m`); a bare number is read as seconds.
- `sticky`, `healthCheck`, and `priority` apply to HTTP. TCP accepts `servers` and `priority`; UDP accepts `servers` only.
- TCP and UDP require a port. Sending it joined to the host (`targetIp=10.0.0.9:5432` with an empty `targetPort`) is accepted and split back apart, including bracketed IPv6; a target with no port at all is refused with `400`.

::: warning Sending `backendsJson*` replaces the whole service
A save that includes `backendsJson*` is authoritative for that service: `servers` is replaced outright, and `sticky` or `healthCheck` absent from the payload are **deleted**. A client that edits backends must read the route first and echo `sticky`, `healthCheck`, and `priority` back, or it will silently drop them. Omit `backendsJson*` entirely to use the merge behaviour described below instead.
:::

::: tip Editing from a single-backend client
A save that omits `backendsJson*` on an edit replaces only the **first** backend. Any additional backends, plus `sticky`, `healthCheck`, and `priority`, are preserved. This is what keeps the mobile app and older cached pages from wiping a multi-backend route.

The same protection applies to shared services: an edit that omits `serviceRef` on a route whose router references a shared or cross-provider service keeps the reference and ignores the posted target fields, so an older client cannot convert a reference into an owned service.
:::

---

### `POST /delete/{route_id}`

Delete a route by ID. Accepts `application/x-www-form-urlencoded`.

| Param | Description |
|---|---|
| `route_id` | Route ID (path) |
| `configFile` | Config file basename (body, multi-config only) |

---

### `POST /api/routes/{route_id}/toggle`

Enable or disable a route without deleting it. Config is preserved in `manager.yml`.

```json
{ "enable": true }
```

---

### `GET /api/configs`

List all loaded dynamic config files.

```json
{
  "files": [{ "label": "routes.yml", "path": "/config/routes.yml" }],
  "configDirSet": true
}
```

---

### `POST /save-middleware`

Create or update a middleware. Config is provided as raw YAML. Accepts `application/x-www-form-urlencoded`.

| Field | Description |
|---|---|
| `middlewareName` | Middleware name |
| `middlewareContent` | Raw YAML body |
| `configFile` | Target config file |
| `isMwEdit` | `true` when updating |
| `originalMwId` | Original ID when renaming |

---

### `POST /delete-middleware/{name}`

Delete a middleware by name. Accepts `application/x-www-form-urlencoded`.

| Param | Description |
|---|---|
| `name` | Middleware name (path) |
| `configFile` | Config file basename (body, multi-config only) |

---

## Traefik

These endpoints proxy read-only data from the Traefik API. They require a valid Traefik API URL in settings.

### `GET /api/traefik/overview`

Router, service, and middleware counts plus Traefik feature flags. Passes through the Traefik dashboard overview object.

---

### `GET /api/traefik/routers`

All routers across HTTP, TCP, and UDP.

```json
{ "http": [...], "tcp": [...], "udp": [...] }
```

---

### `GET /api/traefik/services`

All services across HTTP, TCP, and UDP.

---

### `GET /api/traefik/middlewares`

All middlewares across HTTP and TCP.

Returns `502` with `{"error": "Traefik API unreachable"}` if the Traefik API cannot be reached. Earlier versions returned `200` with empty lists in that case, which made an unreachable Traefik indistinguishable from one that genuinely has no middlewares.

---

### `GET /api/traefik/entrypoints`

All configured entrypoints.

```json
[{ "name": "websecure", "address": ":443" }]
```

Returns `502` with `{"error": "Traefik API unreachable"}` if the Traefik API cannot be reached. Earlier versions returned `200` with an empty list in that case.

---

### `GET /api/traefik/router/{protocol}/{name}`

Details for a specific router. `protocol` is `http`, `tcp`, or `udp`. `name` is URL-encoded.

---

### `GET /api/traefik/version`

Traefik version string and codename.

---

### `GET /api/traefik/ping`

Ping the Traefik API and return latency.

```json
{ "ok": true, "latency_ms": 3 }
```

---

### `GET /api/traefik/plugins`

List plugins defined under `experimental.plugins` in the static config. Requires `STATIC_CONFIG_PATH`.

---

### `GET /api/traefik/certs`

List TLS certificates from ACME (`acme.json`) and file-based (`tls.yml`) sources. Requires `ACME_JSON_PATH`.

| Field | Description |
|---|---|
| `resolver` | ACME resolver name |
| `main` | Primary domain |
| `sans` | Subject alternative names |
| `not_after` | Expiry timestamp (ISO 8601) |
| `certFile` | Source file |

---

### `GET /api/traefik/logs`

Tail Traefik access logs. Requires `ACCESS_LOG_PATH`.

| Query param | Default | Max |
|---|---|---|
| `lines` | `100` | `1000` |

---

### `GET /api/diagnostics/client-ip`

Read-only diagnostic for the current request. Returns what the app sees as the client after `ProxyFix`, the raw socket peer, the forwarding headers as received, the number of trusted proxy hops, and a scope classification (`public`, `private`, `cgnat`, `loopback`, `link-local` or `unknown`) for each observed IP.

```json
{
  "effective_ip": "203.0.113.5",
  "effective_class": "public",
  "socket_peer": "172.20.0.1",
  "socket_peer_class": "private",
  "headers": {
    "X-Forwarded-For": "203.0.113.5",
    "X-Real-IP": "",
    "CF-Connecting-IP": "",
    "X-Forwarded-Proto": "https",
    "X-Forwarded-Host": "example.com"
  },
  "forwarded_for_chain": ["203.0.113.5"],
  "proxy_hops": 1,
  "classes": { "203.0.113.5": "public", "172.20.0.1": "private" }
}
```

---

## Dashboard

### `GET /api/dashboard/config`

Get saved dashboard configuration - custom groups and per-route icon/name overrides.

---

### `POST /api/dashboard/config`

Save dashboard configuration. Replaces the full config in `dashboard.yml`.

```json
{
  "custom_groups": [{ "name": "Media" }],
  "route_overrides": {
    "plex": { "display_name": "Plex", "icon_type": "slug", "icon_slug": "plex", "group": "Media",
              "url": "https://plex.example.com", "link_disabled": false }
  }
}
```

`icon_type` is `auto`, `slug`, or `url`. `url` overrides the URL the dashboard card opens and must start with `http://` or `https://` - anything else is dropped on save. `link_disabled: true` makes the card non-clickable.

---

### `GET /api/dashboard/icon/{slug}`

Serve a cached app icon by slug (e.g. `plex`, `grafana`). Fetches from the selfh.st CDN on cache miss. Responses include `Cache-Control: max-age=86400`.

---

## Settings

### `GET /api/settings`

Get current application settings. Password hash is never included.

| Field                      | Description                                        |
| ----------------------------| ----------------------------------------------------|
| `domains`                  | Allowed domains list                               |
| `cert_resolver`            | Default ACME resolver name(s)                      |
| `traefik_api_url`          | Traefik API base URL                               |
| `acme_json_path`           | Path to `acme.json` inside the container           |
| `access_log_path`          | Path to Traefik access log                         |
| `static_config_path`       | Path to `traefik.yml`                              |
| `auth_enabled`             | Password auth on/off                               |
| `oidc_enabled`             | OIDC on/off                                        |
| `visible_tabs`             | Tab visibility map                                 |
| `webhook_url`              | Notification webhook URL                           |
| `traefik_api_user`         | Traefik API username for basic auth                |
| `traefik_api_password_set` | `true` if a Traefik API password is saved          |
| `crowdsec_lapi_url`        | CrowdSec LAPI URL                                  |
| `crowdsec_api_key_set`     | `true` if a CrowdSec API key is saved              |
| `crowdsec_enabled`         | `true` if both LAPI URL and API key are configured |

---

### `POST /api/settings`

Update settings. Send only the fields you want to change. Also accepts: `traefik_api_user`, `traefik_api_password` (leave blank to keep existing), `crowdsec_lapi_url`, `crowdsec_api_key` (leave blank to keep existing).

---

### `POST /api/settings/webhook-test`

Send a test payload to a webhook URL without saving it.

```json
{ "url": "https://discord.com/api/webhooks/..." }
```

---

### `GET /api/settings/self-route`

Get the saved self-route domain. If none is saved, TM scans config files for an existing route pointing to the TM service.

---

### `POST /api/settings/self-route`

Save or remove the self-route. Sending an empty `domain` deletes the self-route file.

```json
{ "domain": "manager.example.com", "service_url": "http://traefik-manager:5000" }
```

---

### `POST /api/settings/tabs`

Show or hide optional UI tabs.

```json
{ "dashboard": true, "routemap": true, "docker": false }
```

---

### `POST /api/settings/test-connection`

Test connectivity to a Traefik API URL before saving. Accepts optional credentials for auth-protected dashboards.

```json
{ "url": "http://traefik:8080", "user": "admin", "password": "secret" }
```

---

### `GET /api/settings/ui`

Display preferences stored server-side, so they follow the user across browsers and devices.

```json
{ "ok": true, "ui_prefs": { "showApiLink": true, "svcViewMode": "list" } }
```

---

### `POST /api/settings/ui`

Update one or more preferences. Keys not sent keep their current value.

```json
{ "ui_prefs": { "showDocsLink": false, "mwViewMode": "list" } }
```

Accepted keys are the booleans `showStatCards`, `compactStatCards`, `showEntrypoints`, `showDocsLink`, `showApiLink`, `showShortcutsBtn`, `showIpDiagBtn`, `showTraefikBadge`, `showTmBadge`, `showRouteIcons`, and the view modes `routeViewMode`, `mwViewMode`, `svcViewMode`, each `grid` or `list`.

Anything else is dropped rather than stored - this endpoint writes into `manager.yml`, so it only ever accepts the keys above. Returns `400` if `ui_prefs` is not an object.

---

## TLS Options

### `GET /api/tls-options`

List all `tls.options` profiles from all mounted config files.

**Response** - array of profiles:

| Field | Type | Description |
|---|---|---|
| `name` | string | Profile key (e.g. `modern`, `default`) |
| `configFile` | string | Source config file basename |
| `minVersion` | string | Minimum TLS version (e.g. `VersionTLS12`) |
| `maxVersion` | string | Maximum TLS version |
| `sniStrict` | boolean | SNI strict mode enabled |
| `cipherSuites` | string[] | Cipher suite list |
| `curvePreferences` | string[] | ECDH curve list |
| `alpnProtocols` | string[] | ALPN protocol list |
| `clientAuthType` | string | Client auth type |
| `clientAuthCAs` | string[] | CA file paths |
| `yaml` | string | Raw YAML block for display |

---

### `POST /api/tls-options`

Create or update a TLS options profile. Sends JSON body.

| Field | Type | Description |
|---|---|---|
| `name` | string | Profile name (required) |
| `configFile` | string | Target config file basename (multi-config only) |
| `minVersion` | string | e.g. `VersionTLS12` |
| `maxVersion` | string | Optional upper bound |
| `sniStrict` | boolean | Enable SNI strict |
| `cipherSuites` | string[] | Cipher suite list |
| `curvePreferences` | string[] | Curve list |
| `alpnProtocols` | string[] | ALPN list |
| `clientAuthType` | string | Client auth type |
| `clientAuthCAs` | string[] | CA file paths |

---

### `DELETE /api/tls-options/<name>`

Delete a TLS options profile by name.

| Query param | Description |
|---|---|
| `configFile` | Config file basename (multi-config only) |

---

## Backups

### `GET /api/backups`

List all backup files, newest first.

```json
[{ "name": "backup_2026-03-24T22-00-00.yml", "size": 1024, "modified": "2026-03-24T22:00:00" }]
```

---

### `POST /api/backup/create`

Create a manual backup. Returns the backup filename.

---

### `POST /api/restore/{filename}`

Restore configuration from a backup file. Rate-limited to 10/min.

---

### `POST /api/backup/delete/{filename}`

Delete a backup file.

---

## Notifications

### `GET /api/notifications`

List all stored notifications, newest first.

```json
[{ "ts": "2026-04-13 20:25:03", "type": "route_saved", "msg": "Route my-app saved" }]
```

---

### `POST /api/notifications/delete`

Delete a single notification by timestamp.

```json
{ "ts": "2026-04-13 20:25:03" }
```

---

### `POST /api/notifications/clear`

Clear all notifications.

---

## Authentication endpoints

### `POST /api/auth/change-password`

Change the login password. Rate-limited to 10/min.

```json
{ "current_password": "...", "new_password": "...", "confirm_password": "..." }
```

---

### `POST /api/auth/toggle`

Enable or disable password authentication.

```json
{ "auth_enabled": false }
```

---

### `GET /api/auth/otp/status`

Check whether TOTP is enabled.

---

### `POST /api/auth/otp/setup`

Generate a TOTP secret and QR code URI for scanning with an authenticator app. Returns `secret` and `uri`.

---

### `POST /api/auth/otp/enable`

Confirm and activate TOTP using a code from the authenticator app.

```json
{ "code": "123456" }
```

---

### `POST /api/auth/otp/disable`

Disable TOTP.

---

### `GET /api/auth/apikey/status`

List active API keys. Full keys are never returned after generation.

```json
{
  "enabled": true,
  "count": 2,
  "keys": [{ "name": "My Phone", "preview": "abcd1234...ef56", "created_at": "2026-04-03 12:00" }]
}
```

---

### `POST /api/auth/apikey/generate`

Generate a new API key. Up to 10 keys can exist. Rate-limited to 5/hour. The full key is returned once - store it securely.

```json
{ "device_name": "My Phone" }
```

Response: `{ "ok": true, "key": "tm_abcdef123456..." }`

---

### `POST /api/auth/apikey/revoke`

Revoke an API key by its preview string.

```json
{ "preview": "abcd1234...ef56" }
```

---

### `GET /api/auth/oidc`

Get current OIDC configuration. Client secret is never returned.

---

### `POST /api/auth/oidc`

Save OIDC configuration. Leave `oidc_client_secret` blank to keep the existing secret.

| Field | Description |
|---|---|
| `oidc_enabled` | Enable or disable OIDC |
| `oidc_provider_url` | Provider base URL (without `/.well-known/...`) |
| `oidc_client_id` | Client ID |
| `oidc_client_secret` | Client secret (omit to keep existing) |
| `oidc_display_name` | Login button label |
| `oidc_allowed_emails` | Comma-separated allowed emails |
| `oidc_allowed_groups` | Comma-separated allowed groups |
| `oidc_groups_claim` | Claim name containing groups |

---

### `POST /api/auth/oidc/test`

Test connectivity to an OIDC provider's discovery endpoint.

```json
{ "provider_url": "https://accounts.google.com" }
```

---

## Static Config

Requires `STATIC_CONFIG_PATH` to be set. See [Enable Static Config](/static-enable).

### `GET /api/static/available`

Check whether the static config editor is available.

```json
{ "available": true }
```

---

### `GET /api/static/config`

Read and parse the current static config file.

```json
{ "raw": "...", "parsed": { ... }, "path": "/app/traefik.yml" }
```

---

### `POST /api/static/config`

Validate and write an updated static config. A timestamped backup is created before writing.

```json
{ "yaml": "entryPoints:\n  web:\n    address: ':80'\n" }
```

Returns `400` with `{ "error": "..." }` if the YAML is invalid.

---

### `POST /api/static/restart`

Trigger a Traefik restart using the configured `RESTART_METHOD`.

---

### `GET /api/static/status`

Check whether Traefik is currently up. Used by the reconnect overlay after a restart.

```json
{ "up": true }
```

---

### `POST /api/static/section`

Update a single named section of the static config without writing raw YAML.

```json
{
  "action": "add",
  "section": "entrypoints",
  "name": "websecure",
  "data": { "address": ":443" }
}
```

**Supported sections and actions**

| Section | Actions | `data` fields |
|---|---|---|
| `entrypoints` | `add`, `edit`, `remove` | `address`, `redirect_to` |
| `resolvers` | `add`, `edit`, `remove` | `email`, `storage`, `challenge_type`, `provider`, `http_entrypoint` |
| `plugins` | `add`, `edit`, `remove` | `moduleName`, `version` |
| `api` | `set` | `enabled`, `dashboard`, `insecure`, `debug` |
| `log` | `set` | `level`, `accessLog`, `accessLogPath` |
| `providers` | `set` | `docker`, `dockerEndpoint`, `dockerExposedByDefault`, `dockerWatch`, `file`, `fileDirectory`, `fileWatch` |
| `providers` | `add`, `edit`, `remove` | `name` = provider type key, `yaml_config` = YAML body |

Response includes the updated `raw` YAML and `parsed` object.

---

### `POST /api/static/trusted-ips/preview`

Compute the result of adding `forwardedHeaders.trustedIPs` to an entrypoint, without writing anything to disk. Backs the **Trusted IPs** helper in the Static Config editor.

Trusting a proxy's IP makes Traefik believe its `X-Forwarded-For`, which then feeds the access logs, CrowdSec, `ipAllowList`, and the login rate-limiter. Only trust proxies you control.

The merge is **additive with dedup**: existing entries are kept, and ranges already covered are skipped by normalized network (so `10.5.5.5/8` will not re-add `10.0.0.0/8`). Sibling keys under `forwardedHeaders`, other entrypoints, and YAML comments are all preserved. The endpoint never saves - the returned `raw` is persisted by the client through [`POST /api/static/config`](#post-api-static-config), which is why it works identically on the Host and on a remote agent.

Called in two modes.

**Inspect** (no `entrypoint`) - lists entrypoints and the presets:

```json
{ "current_raw": "entryPoints:\n  websecure:\n    address: ':443'\n" }
```

**Preview** (with `entrypoint`) - also returns the merge:

```json
{
  "current_raw": "entryPoints:\n  websecure:\n    address: ':443'\n",
  "entrypoint": "websecure",
  "cloudflare": true,
  "private": false,
  "custom_cidrs": "203.0.113.10, 198.51.100.0/24"
}
```

| Field | Type | Description |
|---|---|---|
| `current_raw` | string | Static config YAML to operate on. Falls back to the file on disk when empty. |
| `entrypoint` | string | Target entrypoint. Omit for inspect mode. |
| `cloudflare` | boolean | Include the built-in Cloudflare edge ranges. |
| `private` | boolean | Include the private-range preset (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`). |
| `custom_cidrs` | string \| string[] | Extra CIDRs or IPs, comma/whitespace-separated or an array. Invalid entries are returned in `invalid` and skipped. |

Inspect mode returns `ok`, `entrypoints` (each with `name`, `address`, `trusted_ips`), `cloudflare_captured`, `cloudflare_ranges`, and `private_ranges`. Preview mode adds `entrypoint`, `existing`, `added`, `invalid`, `final`, the merged `raw` YAML, and the `parsed` object.

Returns `400` if the named entrypoint is absent or the config is not a mapping, and `404` if there is no static config on disk and no `current_raw` was supplied.

---

## Utility

### `GET /api/manager/version`

Get the deployed Traefik Manager version.

```json
{ "version": "1.0.0", "repo": "https://github.com/chr0nzz/traefik-manager" }
```

---

### `GET /api/manager/router-names`

Get all router names across every protocol. Useful for autocomplete.

```json
["my-app@file", "api@file"]
```

---

### `POST /api/setup/test-connection`

Test connectivity to a Traefik API URL. No authentication required.

```json
{ "url": "http://traefik:8080" }
```

---

### `GET /api/ping`

Ping a route's domain from the TM server and return latency. Used by the route health check in the Routes tab.

| Query param | Description |
|---|---|
| `url` | Full URL to ping (must start with `http://` or `https://`) |

```json
{ "ok": true, "latency_ms": 42, "status_code": 200 }
```

On failure: `{ "ok": false, "error": "Timeout", "latency_ms": null }`

---

## CrowdSec

### `GET /api/crowdsec/decisions`

List active CrowdSec decisions (bans, captchas, bypasses). Returns an empty list if CrowdSec is not configured.

**Response**

```json
[
  {
    "id": 1,
    "value": "1.2.3.4",
    "type": "ban",
    "duration": "3h59m",
    "scenario": "crowdsecurity/http-bf",
    "origin": "CAPI"
  }
]
```

---

### `GET /api/crowdsec/alerts`

List recent CrowdSec alerts (up to 50).

**Response**

```json
[
  {
    "startAt": "2026-05-28T10:00:00Z",
    "source": { "ip": "1.2.3.4" },
    "scenario": "crowdsecurity/http-bf",
    "decisions": [{ "type": "ban", "duration": "4h" }]
  }
]
```

---

### `DELETE /api/crowdsec/decisions/{id}`

Unban / remove a decision by ID.

**Response**

```json
{ "ok": true }
```

Returns `{ "ok": false, "error": "..." }` if the deletion fails or CrowdSec is not reachable.

---

## Agents

Manage remote TMA agents registered in TM.

### `GET /api/agents`

List all registered agents. API keys are redacted in the response.

**Response**

```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "Server 2",
      "url": "https://server2.example.com:8090",
      "api_key": "***",
      "created_at": "2026-01-01T00:00:00+00:00",
      "traefik_api_url": "http://traefik:8080",
      "config_path": "/app/config"
    }
  ]
}
```

---

### `POST /api/agents`

Register a new agent. TM generates the API key and returns it once in the response. Store it immediately - it cannot be retrieved again.

**Request body**

```json
{
  "name": "Server 2",
  "url": "https://server2.example.com:8090"
}
```

**Response**

```json
{
  "ok": true,
  "agent": {
    "id": "uuid",
    "name": "Server 2",
    "url": "https://server2.example.com:8090",
    "api_key_raw": "the-plaintext-key-shown-once",
    "api_key": "***"
  }
}
```

---

### `PUT /api/agents/{id}`

Update an agent's config fields (name, URL, paths, restart method, CrowdSec, git backup). Pass only the fields you want to change.

---

### `DELETE /api/agents/{id}`

Remove an agent from TM. Does not stop the agent service on the remote server.

---

### `GET /api/agents/{id}/health`

Check connectivity to an agent.

**Response**

```json
{ "ok": true, "latency_ms": 12, "version": "1.5.1", "status": 200 }
```

Returns `"ok": false` if the agent is unreachable.

---

### `POST /api/agents/{id}/rotate-key`

Generate a new API key for an agent. The new key is returned once as `api_key_raw`.

```json
{ "ok": true, "agent": { "id": "uuid", "api_key": "***" }, "api_key_raw": "the-new-key" }
```

The old key stops working immediately, so the agent is unreachable until its `TMA_API_KEY` is updated and it is restarted.

---

### `GET /api/agents/{id}/routes`

Routes and middlewares on that agent, in the same shape as [`GET /api/routes`](#get-api-routes) - built from the agent's config files and enriched from its Traefik API. Route objects are identical to the Host's, so a client can render either without special-casing.

```json
{
  "apps": [ /* Route[] */ ],
  "middlewares": [ /* Middleware[] */ ],
  "configErrors": [ { "file": "Agent Traefik API", "error": "..." } ]
}
```

If the agent's Traefik API is unreachable, routes from its config files are still returned and the failure appears in `configErrors`.

---

### `GET /api/agents/{id}/cert-resolvers`

Cert resolver names to offer in the route form for that server.

```json
{ "resolvers": ["letsencrypt", "cloudflare"] }
```

Collected from the resolvers already used by that server's routers (via its Traefik API), merged with anything in its static config when mounted, plus the agent's optional `cert_resolver` field. This is why an agent does not need its static config mounted to offer resolvers.

---

### `/api/agents/proxy/{id}/{path}`

Proxy a request to the agent's API. TM injects the `X-Api-Key` header automatically, so a browser or the mobile app can reach an agent without ever holding its key.

Accepts `GET`, `POST`, `PUT`, `DELETE` and `PATCH`. The method, query string and JSON body are forwarded, and the agent's status code and body are returned as-is.

For example, `GET /api/agents/proxy/abc123/traefik/routers` proxies to `GET https://agent-host:8090/api/traefik/routers`.

Returns `502` if the agent cannot be reached.

See the [Agent API Reference](api-agent.md) for every endpoint an agent exposes.

---

## OpenAPI spec

The raw OpenAPI 3.1 spec is available from your instance at:

```
https://your-tm-url/openapi.yaml
```
