<div align="center">

<img src="docs/public/images/icon.png" width="128" height="128" alt="Traefik Manager">

# Traefik Manager

**A clean, self-hosted web UI for managing your Traefik reverse proxy.**

Add routes, manage middlewares, monitor services, and view TLS certificates - all without touching a YAML file by hand.

[![Docker Image](https://img.shields.io/badge/ghcr.io-chr0nzz%2Ftraefik--manager-blue?logo=docker&logoColor=white)](https://github.com/chr0nzz/traefik-manager/pkgs/container/traefik-manager)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)
[![Version](https://img.shields.io/github/v/release/chr0nzz/traefik-manager)](https://github.com/chr0nzz/traefik-manager/releases)
[![Docs](https://img.shields.io/badge/docs-github.io-blue)](https://traefik-manager.xyzlab.dev/)
[![Mobile App](https://img.shields.io/badge/mobile-repo-green?logo=android&logoColor=white)](https://github.com/chr0nzz/traefik-manager-mobile)
[![Google Play](https://img.shields.io/badge/Google_Play-Available-blue?logo=google-play&logoColor=white)](https://play.google.com/store/apps/details?id=dev.chr0nzz.traefikmanager)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Sponsor-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/chr0nzz)

</div>
<div align="center">
<sub>Built for homelabbers who love Traefik but hate editing YAML at 2am.</sub>
</div>

---

## Highlights

- **Routes** - add, edit, clone, and enable/disable HTTP, TCP, and UDP routes from the browser
- **Middlewares** - 24 guided wizards plus a raw YAML editor, for HTTP and TCP
- **Multi-server** - manage unlimited remote Traefik instances through a lightweight Go agent
- **Static config editor** - edit entrypoints, cert resolvers, and plugins; Traefik restarts automatically
- **Backups** - timestamped local backups plus git push with history, diffs, and one-click restore
- **Monitoring** - live services, certificates, access logs, CrowdSec, and CVE advisory warnings
- **Mobile app** - Android companion app on Google Play

## Quick Start

**One-liner installer** - installs Traefik + Traefik Manager together, or Traefik Manager on its own via Docker or a native Linux service:

```bash
curl -fsSL https://get-traefik.xyzlab.dev | bash
```

**Manual Docker Compose:**

```yaml
services:
  traefik-manager:
    image: ghcr.io/chr0nzz/traefik-manager:latest
    container_name: traefik-manager
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - COOKIE_SECURE=false
    volumes:
      - /path/to/traefik/dynamic.yml:/app/config/dynamic.yml
      - /path/to/traefik-manager/config:/app/config
      - /path/to/traefik-manager/backups:/app/backups
```

```bash
docker compose up -d
```

Open **http://your-server:5000** - the setup wizard will guide you through the rest.

---

## Screenshots

<details>
<summary><b>Initial Setup Workflow</b></summary>
<table>
<tr>
<td width="33%">
<a href="docs/public/images/dark-login.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-login.png">
  <img src="docs/public/images/light-login.png" alt="Login" />
</picture></a>
<br /><b>1. Login</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-setup-welcome.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-setup-welcome.png">
  <img src="docs/public/images/light-setup-welcome.png" alt="Welcome" />
</picture></a>
<br /><b>2. Welcome</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-setup-connection.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-setup-connection.png">
  <img src="docs/public/images/light-setup-connection.png" alt="Connection &amp; domains" />
</picture></a>
<br /><b>3. Connection &amp; domains</b>
</td>
</tr>
<tr>
<td>
<a href="docs/public/images/dark-setup-self-route.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-setup-self-route.png">
  <img src="docs/public/images/light-setup-self-route.png" alt="Self route" />
</picture></a>
<br /><b>4. Self route</b>
</td>
<td>
<a href="docs/public/images/dark-setup-monitoring.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-setup-monitoring.png">
  <img src="docs/public/images/light-setup-monitoring.png" alt="Optional tabs" />
</picture></a>
<br /><b>5. Optional tabs</b>
</td>
<td>
<a href="docs/public/images/dark-setup-password.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-setup-password.png">
  <img src="docs/public/images/light-setup-password.png" alt="Set password" />
</picture></a>
<br /><b>6. Set password</b>
</td>
</tr>
</table>
</details>

<details>
<summary><b>Dashboard</b></summary>
<p align="center">
<a href="docs/public/images/dark-dashboard.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-dashboard.png">
  <img src="docs/public/images/light-dashboard.png" width="80%" alt="Dashboard" />
</picture></a>
</p>
</details>

<details>
<summary><b>Routes</b></summary>
<table>
<tr>
<td width="33%">
<a href="docs/public/images/dark-routes-cards.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-routes-cards.png">
  <img src="docs/public/images/light-routes-cards.png" alt="Routes – card view" />
</picture></a>
<br /><b>Card View</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-routes-list.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-routes-list.png">
  <img src="docs/public/images/light-routes-list.png" alt="Routes – list view" />
</picture></a>
<br /><b>List View</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-routes-add-http.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-routes-add-http.png">
  <img src="docs/public/images/light-routes-add-http.png" alt="Add HTTP route" />
</picture></a>
<br /><b>Add HTTP</b>
</td>
</tr>
<tr>
<td>
<a href="docs/public/images/dark-routes-add-tcp.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-routes-add-tcp.png">
  <img src="docs/public/images/light-routes-add-tcp.png" alt="Add TCP route" />
</picture></a>
<br /><b>Add TCP</b>
</td>
<td>
<a href="docs/public/images/dark-routes-add-udp.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-routes-add-udp.png">
  <img src="docs/public/images/light-routes-add-udp.png" alt="Add UDP route" />
</picture></a>
<br /><b>Add UDP</b>
</td>
<td></td>
</tr>
</table>
</details>

<details>
<summary><b>Services</b></summary>
<p align="center">
<a href="docs/public/images/dark-services-cards.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-services-cards.png">
  <img src="docs/public/images/light-services-cards.png" width="48%" alt="Services – card view" />
</picture></a>
<a href="docs/public/images/dark-services-list.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-services-list.png">
  <img src="docs/public/images/light-services-list.png" width="48%" alt="Services – list view" />
</picture></a>
</p>
</details>

<details>
<summary><b>Middlewares</b></summary>
<table>
<tr>
<td width="33%">
<a href="docs/public/images/dark-middlewares-cards.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-middlewares-cards.png">
  <img src="docs/public/images/light-middlewares-cards.png" alt="Middlewares – card view" />
</picture></a>
<br /><b>Card View</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-middlewares-list.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-middlewares-list.png">
  <img src="docs/public/images/light-middlewares-list.png" alt="Middlewares – list view" />
</picture></a>
<br /><b>List View</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-middlewares-add.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-middlewares-add.png">
  <img src="docs/public/images/light-middlewares-add.png" alt="Add middleware" />
</picture></a>
<br /><b>Add</b>
</td>
</tr>
</table>
</details>

<details>
<summary><b>Plugins</b></summary>
<p align="center">
<a href="docs/public/images/dark-plugins.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-plugins.png">
  <img src="docs/public/images/light-plugins.png" width="48%" alt="Plugins" />
</picture></a>
<a href="docs/public/images/dark-plugins-add.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-plugins-add.png">
  <img src="docs/public/images/light-plugins-add.png" width="48%" alt="Plugins – add" />
</picture></a>
</p>
</details>


<details>
<summary><b>Route Map</b></summary>
<p align="center">
<a href="docs/public/images/dark-route-map.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-route-map.png">
  <img src="docs/public/images/light-route-map.png" width="80%" alt="Route Map" />
</picture></a>
</p>
</details>

<details>
<summary><b>Settings</b></summary>
<table>
<tr>
<td width="33%">
<a href="docs/public/images/dark-settings-interface.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-settings-interface.png">
  <img src="docs/public/images/light-settings-interface.png" alt="Settings – interface" />
</picture></a>
<br /><b>Interface</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-settings-auth-password.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-settings-auth-password.png">
  <img src="docs/public/images/light-settings-auth-password.png" alt="Settings – auth" />
</picture></a>
<br /><b>Authentication</b>
</td>
<td width="33%">
<a href="docs/public/images/dark-settings-auth-apikeys.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-settings-auth-apikeys.png">
  <img src="docs/public/images/light-settings-auth-apikeys.png" alt="Settings – API keys" />
</picture></a>
<br /><b>API Keys</b>
</td>
</tr>
<tr>
<td>
<a href="docs/public/images/dark-settings-static-config.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-settings-static-config.png">
  <img src="docs/public/images/light-settings-static-config.png" alt="Settings – static config" />
</picture></a>
<br /><b>Static Config</b>
</td>
<td>
<a href="docs/public/images/dark-settings-connection.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-settings-connection.png">
  <img src="docs/public/images/light-settings-connection.png" alt="Settings – connection" />
</picture></a>
<br /><b>Connection</b>
</td>
<td>
<a href="docs/public/images/dark-settings-backups.png" target="_blank"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/dark-settings-backups.png">
  <img src="docs/public/images/light-settings-backups.png" alt="Settings – backups" />
</picture></a>
<br /><b>Backups</b>
</td>
</tr>
</table>
</details>

---

## Features

### Routes

- Add, edit, clone, delete, and enable/disable **HTTP, TCP, and UDP** routes
- **Multiple domains per route** with a chip builder, or switch to the **advanced rule editor** for complex expressions (`PathPrefix`, `HostRegexp`, `&&` / `||`)
- **Per-route certificate resolver** - pick any configured resolver, request **wildcard certificates**, or disable TLS
- **TLS options profiles** - create named `tls.options` (min/max version, ciphers, mTLS, SNI strict) and assign them per route
- **insecureSkipVerify per service** for backends with self-signed certs (Proxmox, Kasm, etc.)
- **Multi-config file support** - mount several dynamic files via `CONFIG_DIR` / `CONFIG_PATHS`, choose the target file per route, create new files from the UI
- Optional **app icons** on route cards and lists, shared with the Dashboard tab

### Middlewares

- **24 guided wizards**: Basic/Digest Auth, Forward Auth (with Authentik, Authelia, and Gatekeeper presets), OIDC Auth, Rate Limit, In-Flight Requests, IP Allowlist, Secure Headers, CORS, Redirects, Strip/Add/Replace Prefix, Retry, Circuit Breaker, Buffering, Compress, Chain, Encoded Characters, and more
- **Raw YAML editor** for anything the wizards don't cover
- **TCP middlewares** alongside HTTP
- **Provider middlewares** (Docker, Kubernetes, etc.) shown read-only in the provider tabs

### Live Dashboard & Monitoring

- Real-time stats: router counts, service health, entrypoints, Traefik version
- **Provider tabs**: Docker, Kubernetes, Swarm, Nomad, ECS, Consul Catalog, Redis, etcd, Consul KV, ZooKeeper, HTTP, File - all API-based, no extra mounts
- **Traefik CVE advisory warnings** - flags known security advisories affecting your running Traefik version
- Optional tabs (toggle in Settings):
  - **Dashboard** - routes grouped by category with app icons from [selfh.st/icons](https://selfh.st/icons/), per-card name/icon/group overrides
  - **Route Map** - entry points, routes, middlewares, and services in a visual topology
  - **Certs** - `acme.json` certificates with expiry tracking
  - **Logs** - parsed access log cards with full-detail panel
  - **CrowdSec** - decisions and alerts from a LAPI; ban, captcha, bypass, or unban IPs with one click
- Card/list view toggle on Routes, Middlewares, and Services

### Static Config Editor *(optional - mount `traefik.yml` read-write)*

- Edit **entrypoints, certificate resolvers, and plugins** from the UI; raw **Monaco** YAML editor for everything else
- Changes are staged, backed up, and Traefik is **restarted automatically** - via socket proxy (recommended), poison pill (no socket needed), or direct socket
- Full-screen reconnect overlay polls until Traefik is back up

### Backups

- **Timestamped backups** before every change, one-click restore, **configurable retention**
- **Git repository backup** - auto-push your config to GitHub, Gitea, Forgejo, GitLab, or any HTTPS remote; browse commit history, view side-by-side diffs, restore any commit, set custom commit messages

### Multi-Server (Agents)

- **Traefik Manager Agent (TMA)** - a lightweight Go daemon that runs next to Traefik on any remote server
- **Server switcher** in the nav bar - every tab (routes, services, middlewares, backups, logs) works against the active server
- Setup wizard generates a ready-to-paste Docker Compose or Docker Run command; API key shown once and stored encrypted
- Per-agent git backup; manage unlimited servers from one TM - no VPN or SSH required

### Notifications

- In-app notification center for logins, config saves, restarts, backups, and CrowdSec actions
- **Webhook forwarding** to Discord or ntfy, with a test button in Settings

### Security

- **bcrypt passwords** (cost 12), optional **TOTP 2FA**, session fixation protection, configurable inactivity timeout
- **OIDC / SSO** - Keycloak, Google, Authentik, or any OIDC provider; restrict by email or group; can run as the **sole login method** with built-in auth disabled
- **Per-device API keys** (up to 10, individually revocable) - the mobile app keeps working in every auth mode
- CSRF protection, rate limiting, SSRF and git-transport hardening, secrets encrypted at rest (Fernet), atomic config writes
- See the [security](https://traefik-manager.xyzlab.dev/security.html) and [Traefik hardening](https://traefik-manager.xyzlab.dev/hardening.html) docs

---

## Deployment

| Runtime                                                                                                              | Guide                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------| -----------------------------------------------------------------------------------------------------------------------|
| <img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/windows-terminal.png" width="20" height="20"> Installer | [One-liner: full stack, TM-only Docker, TM-only Linux service, Agent](https://traefik-manager.xyzlab.dev/traefik-stack.html) |
| <img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/docker.png" width="20" height="20"> Docker              | [Docker Compose setup, networking, behind Traefik](https://traefik-manager.xyzlab.dev/docker.html)                    |
| <img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/podman.png" width="20" height="20"> Podman              | [Rootless, Quadlet/systemd, SELinux labels](https://traefik-manager.xyzlab.dev/podman.html)                           |
| <img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/linux.png" width="20" height="20"> Linux                | [Native Python + systemd, no container required](https://traefik-manager.xyzlab.dev/linux.html)                       |
| <img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/unraid.png" width="20" height="20"> Unraid              | [Community Applications template, networking, multi-config](https://traefik-manager.xyzlab.dev/unraid.html)           |
| <i>Agent</i>                                                                                                         | [TMA - remote agent for multi-server management](https://traefik-manager.xyzlab.dev/agent.html)                       |

---

## Documentation

Full documentation at **[traefik-manager.xyzlab.dev](https://traefik-manager.xyzlab.dev/)**

|                                                                           |                                                       |
| ---------------------------------------------------------------------------| -------------------------------------------------------|
| [Get Started](https://traefik-manager.xyzlab.dev/guide.html)              | Deployment guides for Docker, Podman, and Linux       |
| [Traefik Stack](https://traefik-manager.xyzlab.dev/traefik-stack.html)    | One-liner installer guide                             |
| [Configuration](https://traefik-manager.xyzlab.dev/manager-yml.html)      | `manager.yml` reference                               |
| [Environment Variables](https://traefik-manager.xyzlab.dev/env-vars.html) | `CONFIG_DIR`, `CONFIG_PATHS`, auth, domains, and more |
| [Security](https://traefik-manager.xyzlab.dev/security.html)              | API keys, sessions, CSRF, rate limits, and hardening  |
| [Traefik Hardening](https://traefik-manager.xyzlab.dev/hardening.html)    | CVE advisories, header aliases, forwardAuth limits    |
| [API Reference](https://traefik-manager.xyzlab.dev/api.html)              | REST API for integrations and the mobile app          |
| [OIDC / SSO](https://traefik-manager.xyzlab.dev/oidc.html)                | OIDC setup, provider examples, and access control     |
| [Git Repository Backup](https://traefik-manager.xyzlab.dev/git-backup.html) | Auto-push, commit history, diff viewer, and one-click restore |
| [Mobile App](https://traefik-manager.xyzlab.dev/mobile.html)              | Android companion app setup and features              |
| [Reset Password](https://traefik-manager.xyzlab.dev/reset-password.html)  | CLI reset, TOTP recovery, manual reset                |
| [UI Examples](https://traefik-manager.xyzlab.dev/ui-examples.html)        | Screenshots and walkthroughs                          |
| [Provider Tabs](https://traefik-manager.xyzlab.dev/tab-docker.html)       | Docker, Kubernetes, Swarm, Nomad, ECS, and more       |

---

## Mobile App

**traefik-manager-mobile** is a React Native companion app for managing Traefik Manager from your phone. Requires **Traefik Manager v1.0.0 or higher**.

|          |                                                                                                |
| ----------| ------------------------------------------------------------------------------------------------|
| Repo     | [github.com/chr0nzz/traefik-manager-mobile](https://github.com/chr0nzz/traefik-manager-mobile) |
| Download | [Latest release](https://github.com/chr0nzz/traefik-manager-mobile/releases/latest)            |
| Auth     | Per-device API key - generate one in **Settings → Authentication → App / Mobile API Keys**     |

<a href="https://play.google.com/store/apps/details?id=dev.chr0nzz.traefikmanager">
  <img src="static/icons/GetItOnGooglePlay.svg" alt="Get it on Google Play" height="60" />
</a>

Features: browse routes, middlewares, and services · enable/disable routes · add and edit routes and middlewares with guided wizards · multiple domains per route · per-service insecureSkipVerify · multi-config file picker · edit mode for bulk actions · CrowdSec tab · system light/dark theme.

---

## Tech Stack

| Layer     | Technology                                    |
| -----------| -----------------------------------------------|
| Backend   | Python 3.11 · Flask · Gunicorn                |
| Agent     | Go 1.23 · Alpine Linux (TMA - remote agent daemon) |
| Config    | ruamel.yaml (preserves comments)              |
| Auth      | bcrypt · pyotp (TOTP) · Flask sessions · CSRF · Flask-Limiter · Fernet |
| Frontend  | Vanilla JS · Tailwind CSS · Phosphor Icons    |
| Editor    | Monaco Editor (VS Code engine)                |
| Route Map | dagre (graph layout)                          |
| Container | Docker · Alpine Linux · all JS/CSS dependencies bundled at build time (no CDN at runtime) |

---

## Contributing

Pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report bugs, suggest features, and run the project locally.

## Star History

<a href="https://www.star-history.com/?repos=chr0nzz%2Ftraefik-manager&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=chr0nzz/traefik-manager&type=date&theme=dark&legend=top-left&sealed_token=oQ__sQS09Vl71fXzxJNG40hpV_FisG6wxonR_P3lCUWpLBsdQ7L1nIcJSRlkgBebijfWkKO2X0NT-k4jPHXnLz3sthfOc9sxZbXVeRdse4MNHp7w8WkA1GcRgwl-6SHJDi8h3Amcc-ymm0GnUL4sJuqeL3uBlfPO_ib8UNdeoRsTFEAva86ntE_B-UV5" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=chr0nzz/traefik-manager&type=date&legend=top-left&sealed_token=oQ__sQS09Vl71fXzxJNG40hpV_FisG6wxonR_P3lCUWpLBsdQ7L1nIcJSRlkgBebijfWkKO2X0NT-k4jPHXnLz3sthfOc9sxZbXVeRdse4MNHp7w8WkA1GcRgwl-6SHJDi8h3Amcc-ymm0GnUL4sJuqeL3uBlfPO_ib8UNdeoRsTFEAva86ntE_B-UV5" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=chr0nzz/traefik-manager&type=date&legend=top-left&sealed_token=oQ__sQS09Vl71fXzxJNG40hpV_FisG6wxonR_P3lCUWpLBsdQ7L1nIcJSRlkgBebijfWkKO2X0NT-k4jPHXnLz3sthfOc9sxZbXVeRdse4MNHp7w8WkA1GcRgwl-6SHJDi8h3Amcc-ymm0GnUL4sJuqeL3uBlfPO_ib8UNdeoRsTFEAva86ntE_B-UV5" />
 </picture>
</a>

## License

[GPL-3.0](LICENSE)
