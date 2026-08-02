# Dashboard Tab

The **Dashboard** tab shows all your Traefik routes grouped by category, with app icons, per-card editing, and custom group management. Cards are clickable, so the Dashboard doubles as a homepage-style launcher for your services.

## Enabling the tab

The Dashboard tab is hidden by default. To show it, go to **Settings - Interface - Tabs** and toggle **Dashboard** on. You can also enable it during the initial setup wizard. The preference is saved to `manager.yml` and persists across restarts.

---

## Groups view

Routes are automatically grouped into categories by name - Media, Monitoring, Infrastructure, Security, Home, Files & Data, Network, Dev, Servers, and Other. Each group is a card showing all its routes.

### Route rows

Each route row shows:

- **App icon with a status dot** - the icon comes from the selfh.st icon CDN, cached locally in `/config/cache/`; the small dot on its corner is live router state from the Traefik API: green up, red down or router error, hollow when the API is unavailable
- **Name** - display name (customisable) or route name, with a TCP/UDP chip when not HTTP
- **Domain** - the URL the card opens, in blue monospace, when the card is clickable; otherwise the backend target
- **Security glyph** - only when something is worth flagging: an amber open lock for a public route without TLS, a muted house for internal-only. Secure routes show nothing, like a browser address bar
- **Launch arrow** - a faint arrow at the row's end marks clickable cards

The backend target, full URL, and middleware list live in the row's tooltip; full detail stays in the route panel.

### Launching apps

Clicking a card opens the service in a new tab. The URL is derived from the route itself: the first `Host` in the rule, `https` when the router has TLS enabled and `http` otherwise, with a `PathPrefix` from the same rule appended.

Hovering a card reveals two buttons: an info button that opens the route detail panel, and the pencil that opens the card editor.

Cards for routes with nothing to open stay unlinked: TCP and UDP routes, `HostSNI` and regex rules, rules without a `Host`, wildcard hosts, and cards with the link disabled. Everything else on those cards works the same.

Middle-click and ctrl-click open in a background tab, since cards are real links.

### Expand / collapse

Groups with more than 5 routes show only the first 5 by default. Click **Show X more** at the bottom of the group to expand, and **Show less** to collapse.

---

## Per-card editing

Click the pencil icon that appears on a route row when you hover it to open the Edit Route modal.

### Display name

Override the route name shown in the card. Leave blank to use the original route name.

### Icon

Three modes:

- **Auto** - icon is auto-detected from the route or service name using the selfh.st CDN
- **selfh.st slug** - enter a slug directly (e.g. `plex`, `grafana`) - see [selfh.st/icons](https://selfh.st/icons/) for available icons
- **Custom URL** - enter any direct image URL to use as the icon

Icons are fetched once and cached on disk at `/config/cache/{slug}.png` so they are served locally on subsequent loads.

If a self-route is configured for Traefik Manager (**Settings → System → Expose via Traefik**), its dashboard card automatically shows the Traefik Manager icon instead of a CDN lookup.

These per-route icon overrides are also used by the [Routes tab](tab-routes.md#app-icons) when its **Show app icons** option is enabled, so an icon you set here appears there too.

### Group assignment

Override which group the route belongs to. Select **Auto-detect** to let the keyword matching decide, or pick any built-in or custom group.

### Link URL

Override the URL the card opens, for cards where the route's URL is not the right landing page - for example a route that serves an API while the UI lives elsewhere. Only `http://` and `https://` URLs are accepted. The **Disable link for this card** checkbox turns the card back into a plain informational row.

---

## Custom groups

Click the tag icon in the filter bar to open the Route Groups modal.

Routes not matched by any built-in category go into **Other**. Custom groups let you catch specific routes and give them their own card instead.

To add a group: enter a name. Routes are assigned to it via the pencil icon on each route row - select the group in the Group assignment field. Custom groups appear at the top of the group dropdown in the edit modal.

Custom groups are saved to `/config/dashboard.yml` and persist across restarts.

---

## Group detection

Groups are assigned automatically by matching the route or service name against a built-in keyword list. Routes that do not match any category go into **Other**.

| Group | Matches |
|-------|---------|
| Media | jellyfin, sonarr, radarr, immich, qbittorrent, plex, prowlarr, ... |
| Monitoring | grafana, prometheus, uptime-kuma, glances, speedtest, ... |
| Infrastructure | traefik, portainer, gitea, n8n, komodo, ... |
| Security | authentik, authelia, vaultwarden, crowdsec, wireguard, ... |
| Home | home-assistant, node-red, esphome, zigbee2mqtt, frigate, ... |
| Files & Data | nextcloud, paperless, mealie, bookstack, syncthing, ... |
| Network | pihole, adguard, unifi, tailscale, ... |
| Dev | gitea, gitlab, forgejo, code-server, coder, drone, jenkins, argocd, harbor, sonar, jupyter, ... |
| Servers | proxmox, cockpit, idrac, ilo, ipmi, truenas, freenas, opnsense, pfsense, unraid, synology, ... |
| Other | everything else |

---

## Filtering

- **Search** - type to filter routes by name
- **Protocol** - show only HTTP, TCP, or UDP routes
- **Provider** - filter by Traefik provider (file, docker, kubernetes, etc.). Only appears when routes from more than one provider are present.

---

## Providers

Routes from all Traefik providers are shown - not just file-based routes. Docker, Kubernetes, Consul Catalog, and other dynamic provider routes appear alongside file routes.

Routes from non-file providers are read-only: the per-card pencil icon lets you customise the display name and icon, but the route config itself (rule, service, entry points) can only be changed through the provider that manages it. The route detail panel's Edit button is hidden for these routes.

---

## Data source

Fetches from:

- `/api/routes` - routes from all providers (file-managed + live from Traefik API)
- `/api/traefik/entrypoints` - entry point names from the Traefik API
- `/api/dashboard/config` - custom groups and per-route overrides from `dashboard.yml`
- `/api/dashboard/icon/<slug>` - app icons (cached from selfh.st CDN)

Data is cached for 30 seconds. Opening the tab re-renders it, and refetches once the cache is older than that, so config changes made outside this browser tab (another session, the static config editor, or a direct file edit) appear without a page reload. Adding, editing, deleting, or toggling a route refreshes it immediately.

If the Traefik API cannot be reached, the tab shows an error toast and retries the next time you open it instead of caching the empty result.
