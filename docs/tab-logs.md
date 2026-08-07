# Logs Tab

The **Logs** tab displays Traefik's access log - a record of every HTTP request routed through Traefik, including status codes, response times, upstream targets, and client IPs.

## Analytics panel

Above the log list, an analytics panel summarises the loaded entries. It uses the same visual language as the dashboard stat cards: a plain-language verdict, a scope row, seven cards and a runtime footer. Colour is rationed - a healthy card shows colour only in its small category glyph, and problems appear as coloured counts and a coloured card spine.

**Verdict** - one line summarising the whole panel, for example `9 server errors` or `All clean`, with the worst status codes as clickable counts and a `4m 12s window` freshness stamp.

**Window row** - states plainly what the numbers describe: `last 100 lines`, the time `span` they cover, the request rate, and how many lines failed to parse. The span and the rate always describe the whole fetched window, so filtering never changes them; when a filter is active, a separate `selection spans` fact reports the time range of the rows you selected. Active filters appear here and can be cleared from here.

**Cards**
- **Status Codes** - total requests, a signal strip with one cell per request (worst first, hover for the real request), and a 2xx / 3xx / 4xx / 5xx breakdown in the footer. 1xx responses get their own band, and anything unparseable or outside 100-599 (including a status of `-`) is bucketed as `other` rather than silently dropped.
- **Response Time** - average, plus `p50 / p95 / max` with the slowest request named, and `under 100ms / 100-500ms / over 500ms` bands with their thresholds shown. Durations come from the raw nanosecond field, not from a rounded display string. Protocol upgrades - a websocket (`101`) or a CONNECT tunnel - are left out of every one of those numbers, because Traefik logs the whole connection lifetime as the duration and a chat app held open for 40 minutes would otherwise read as a 40-minute response. They are reported separately as `N upgrades, longest 41m`, with their own footer band and their own filter, and they never push the card or the verdict into a warning.
- **Methods** - one flat row per verb with counts and share.
- **Domains** - the requested hosts. **JSON format only**; see the format note below.
- **Paths** - the busiest and worst paths. Paths differing only by a numeric, date, UUID or long-hex segment fold into one pattern such as `/api/timeline/bucket/<_>`, marked with an asterisk, and only when the pattern merges two or more real paths. The footer reports how many paths were seen exactly once, so the ranked rows are not mistaken for the whole distribution.
- **Clients** - client IPs with their scope shown as a small glyph plus flat text (`public`, `private`, `cgnat`, `loopback`, `link local`), so local noise such as a gateway's `192.168.x.1` from hairpin NAT is easy to tell apart from real public clients. The footer breaks the window down by scope.
- **Services** - the Traefik services that handled the requests, with the `@provider` suffix shown separately. Named **Routers** on a `common` format log; see below. Traefik names no service when it answers a request itself, so on a JSON log this card can still come up empty. It then says which of the two reasons applies - the lines carry no `ServiceName`, or the filters you have applied happen to select only such lines - instead of telling a JSON user to switch to JSON. **Domains** behaves the same way.

**Where it fails** - when anything failed, a panel below the grid lists the worst (status code, path) pairs with the share of that path's own traffic, so `3 502s out of 3 requests to /immich` is distinguishable from `3 404s out of 900 on /favicon.ico`.

**Runtime footer** - the detected log format, how many lines parsed, timing precision, whether TLS fields are present, and whether geolocation is on.

Ranked rows are ordered worst-first: an object with server errors outranks one with client errors, which outranks a purely high-volume one. Every row shows its own count and share, and its tooltip gives the failure ratio.

### Filtering by clicking

Every count, row, band and footer item in the panel is a button that filters the log list and re-scopes the whole panel. Clicking a row's inline error count applies two filters at once, jumping straight from "48 client errors" to the exact requests. A target that sets several filters behaves as one intent: clicking it again clears all of them together, and clicking a different compound target replaces the whole set rather than half of it. Filters match parsed fields, not raw text, so filtering by `404` never matches a byte count or a path that happens to contain `404`. Where a count covers both client and server errors, the link filters to both rather than to whichever class happens to be larger, so the number you clicked is the number of rows you get.

Filters compose with the search box and the country filter, and nothing is ever dropped behind your back: a filter that matches nothing under the current search stays in the window row, dimmed, and comes back as soon as the search widens. The panel and the log list always describe the same set of requests. The map is the one deliberate exception - it keeps showing every country's full counts even while one country is selected, so you can switch to another country in one click instead of having to clear the filter first.

### Honest scope

The panel only ever describes the last N lines of the access log, chosen with the 100 / 200 / 500 / 1000 buttons. Traefik does not report the file's total length, so the panel does not claim a share of overall traffic - the funnel on the right says `sample, not all traffic` and the oldest line shown is the edge of the fetched window, not the start of activity. Lines that fail to parse are counted separately and listed in full below rather than being silently discarded.

### Compact mode

**Settings → Interface → Compact stat cards** applies to this panel as well as the dashboard. The markup is identical in both densities; compact tightens spacing, shrinks the hero numbers, hides the share column and shows four rows per card instead of six, with the trailing summary line adjusted to match.

## What it shows

Each log entry is parsed into a card showing:

- **Method badge** - color-coded HTTP verb (GET, POST, DELETE, etc.)
- **Status badge** - status code with description (e.g. `404 Not Found`, `502 Bad Gateway`)
- **Path** - request path, truncated if long
- **IP** - client IP address
- **Service name** - Traefik service that handled the request (when available)
- **Duration** - response time

Click any card to open a detail panel with all available fields (path, IP, date, domain, scheme, entry point, size, duration, origin status, retry attempts, TLS version, router, service, backend URL) and the full raw log line. When Traefik answered a request itself (a forward-auth reject, a redirect middleware or an error page) the drawer shows the backend's own status alongside it.

## Enabling the tab

### During setup wizard
Toggle **Logs** on in the "Optional monitoring" step.

### After setup
Go to **Settings → System Monitoring** and enable Logs.

## Requirements

Traefik must have access logging enabled. Add this to your `traefik.yml`:

```yaml
accessLog:
  filePath: "/logs/access.log"
  format: common
```

Both the `common` (CLF text) and `json` access log formats are parsed into cards. Lines that match neither are shown as-is and excluded from the analytics panel, which reports how many were skipped.

### What `format: common` cannot tell you

Traefik's `common` writer emits a fixed field list, so some cards degrade rather than guess:

| Card | `format: json` | `format: common` |
|---|---|---|
| Domains | ranks `RequestHost`, with the entry point per row | states that CLF carries no Host field and links to the static config |
| Services | ranks `ServiceName` | renamed **Routers**, because CLF field 11 is the router name, not the service |
| Response Time | nanosecond precision, `p50 / p95 / max` | whole milliseconds |
| TLS, retries, origin status | available | not logged |

`accessLog.fields.names` only applies to the JSON formatter, so it cannot add these back to a `common` log. Switch to `format: json` for the full panel:

```yaml
accessLog:
  filePath: "/logs/access.log"
  format: json
```

Then point traefik-manager at the log file via the `ACCESS_LOG_PATH` environment variable (default: `/app/logs/access.log`).

:::tabs
== Docker / Podman
Mount the log file into both containers at the same path:

```yaml
services:
  traefik:
    volumes:
      - ./logs:/logs

  traefik-manager:
    volumes:
      - ./logs:/app/logs:ro
    # ACCESS_LOG_PATH defaults to /app/logs/access.log - no env var needed
```

Or use a custom path:
```yaml
  traefik-manager:
    environment:
      - ACCESS_LOG_PATH=/logs/access.log
    volumes:
      - ./logs:/logs:ro
```

== Linux (systemd)
```ini
Environment=ACCESS_LOG_PATH=/var/log/traefik/access.log
```

Make sure the `traefik-manager` user has read access:
```bash
chmod o+r /var/log/traefik/access.log
# or add to the owning group:
usermod -aG adm traefik-manager
```
:::

## Geolocation

When [IP geolocation](geoip.md) is enabled (**Settings → Interface → Geolocation**), the Logs tab adds a country flag next to each client IP, a **Geography** breakdown, and a shaded **world map** of where the requests came from. Click a country on the map or in the list to filter the log entries to it. Lookups run on the server against a local database, so no IP addresses are sent to any third party.

## Client IP diagnostic

The **network** icon in the top navigation bar opens a read-only **Client IP Diagnostic** for your own request. It shows:

- **App sees (client)** - the IP traefik-manager treats as the client after `ProxyFix`. This is the address that feeds the login/audit log, and the one your `ipAllowList` and CrowdSec rules match against.
- **Socket peer** - the IP on the other end of the raw TCP connection (your reverse proxy, or the real client if there is none).
- **Trusted hops** - how many proxy hops the app trusts when reading `X-Forwarded-For`.
- **Forwarding headers** - the raw `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `X-Forwarded-Proto` and `X-Forwarded-Host` values as received.

Each IP is tagged with the same scope classification as the Clients card. If the client IP the app trusts is private, loopback or CGNAT while you expect public clients, the panel warns you - that usually means the upstream proxy's `trustedIPs` or the trusted-hop count is off, and the real client IP is being lost before it reaches logs, CrowdSec and `ipAllowList`.

For hairpin-NAT'd LAN traffic the real client IP is already gone at the network layer, so it cannot be recovered here - the panel only reports what actually arrives.

## Notes

- Only the most recent entries are shown (tail view)
- The log is not streamed live - refresh the tab to see new entries
- For real-time log output, use the **Live Monitor** tab
