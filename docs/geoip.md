# IP Geolocation

Traefik Manager can resolve client IP addresses to countries and show them in the [Logs](tab-logs.md) and [CrowdSec](tab-crowdsec.md) tabs - a country flag on every IP, a **Top Countries** breakdown, and a shaded **world map** you can click to filter.

::: tip Privacy
All lookups happen **on the server against a local database**. IP addresses are never sent to any third-party geolocation API, there are no per-request network calls, and it keeps working offline. Only the database file itself is downloaded (once a month) from DB-IP.
:::

## Enabling it

1. Open **Settings → Interface → Geolocation** and turn on **IP geolocation**.
2. TM downloads the free country database automatically. You can also click **Download / Update** at any time to refresh it.

That's it - open the Logs or CrowdSec tab and IPs will show their country.

## What you get

- **Logs tab** - a flag next to each client IP, the country in the log detail panel, a Top Countries list, and a world map. Click a country to filter the log entries.
- **CrowdSec tab** - a **Country** column on decisions and alerts, a Top Countries list, and a world map of where banned/flagged IPs are located. Click a country to filter.

Remote agents are covered automatically - the Host performs the lookups on the data it fetches from each agent, so no agent-side configuration is needed.

## The database

By default TM uses the free **[DB-IP Lite](https://db-ip.com) IP-to-Country** database:

- **License:** CC-BY 4.0 - the only requirement is the visible "IP Geolocation by DB-IP" credit shown in the app.
- **Size:** ~4 MB, country-level.
- **Updates:** published monthly; TM refreshes it automatically (and on demand from Settings).
- **Download:** keyless, no account needed.

The database is stored at `CONFIG_DIR/geoip/dbip-country-lite.mmdb`.

### Using your own database

Point the `GEOIP_DB_PATH` environment variable at any MaxMind DB format (`.mmdb`) file and TM will read that instead - for example a MaxMind GeoLite2 or a paid DB-IP database:

```yaml
environment:
  - GEOIP_DB_PATH=/data/GeoLite2-Country.mmdb
volumes:
  - /path/to/GeoLite2-Country.mmdb:/data/GeoLite2-Country.mmdb:ro
```

When `GEOIP_DB_PATH` is set, the built-in DB-IP auto-download is not used.

## Settings reference

| Setting | Where | Description |
|---|---|---|
| IP geolocation | Settings → Interface → Geolocation, or `geoip_enabled` in `manager.yml` | Master on/off toggle (off by default) |
| `GEOIP_DB_PATH` | Environment variable, or `geoip_db_path` in `manager.yml` | Path to a custom `.mmdb`; overrides the built-in DB-IP download |

## Notes

- Private and internal IP ranges are not in the country database, so they simply show no flag.
- Geolocation is country-level. City-level accuracy is not needed for the map and keeps the database small.
- Turning the feature off removes the flags, map, and Country columns on the next refresh.
