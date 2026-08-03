# Traefik Manager

A self-hosted web UI for managing and monitoring your [Traefik](https://traefik.io/) reverse proxy - add routes, manage middlewares, view TLS certificates, and inspect live traffic, all without editing YAML by hand.

---

## Get Started

<div class="vp-grid-cards">
<div class="vp-card">

**<img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/windows-terminal.png" style="height:24px;width:24px;vertical-align:middle;display:inline-block">  Traefik Stack**

One command installs Traefik + Traefik Manager together, or Traefik Manager on its own via Docker or a native Linux service.

[Traefik Stack guide →](traefik-stack.md)

</div>
<div class="vp-card">

**<img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/docker.png" style="height:24px;width:24px;vertical-align:middle;display:inline-block"> Docker**

Deploy with Docker Compose - minimal setup, pre-built image on GHCR.

[Docker guide →](docker.md)

</div>
<div class="vp-card">

**<img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/podman.png" style="height:24px;width:24px;vertical-align:middle;display:inline-block"> Podman**

Rootless containers, Quadlet/systemd, SELinux volume labels.

[Podman guide →](podman.md)

</div>
<div class="vp-card">

**<img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/linux.png" style="height:24px;width:24px;vertical-align:middle;display:inline-block"> Linux (native)**

Run directly on the host with Python + systemd. No container runtime needed.

[Linux guide →](linux.md)

</div>
<div class="vp-card">

**<img src="https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/unraid.png" style="height:24px;width:24px;vertical-align:middle;display:inline-block"> Unraid**

Install on Unraid with a pre-built template.

[Unraid guide →](unraid.md)

</div>
</div>

---

## Management

These tabs are always visible. They let you read and write your Traefik dynamic config.

| Tab | Description |
|-----|-------------|
| [Routes](tab-routes.md) | Create, edit, delete, and enable/disable HTTP, TCP, and UDP routes |
| [Middlewares](tab-middlewares.md) | Create and manage middlewares with built-in templates |
| [Services](tab-services.md) | Read-only view of all services across every provider |

**Multiple config files** - mount several Traefik dynamic config files using `CONFIG_DIR` or `CONFIG_PATHS`. A dropdown in the route/middleware modals lets you choose which file each entry is saved to. See [Environment Variables](env-vars.md) for setup.

---

## Static Config Editor

Edit your Traefik static config (`traefik.yml`) directly from the UI - no SSH or file editor needed. Changes are staged and backed up automatically; a one-click restart applies them via your configured restart method.

**What you can manage:**
- Entrypoints - add, edit, and remove
- Certificate resolvers - ACME/Let's Encrypt configuration
- Plugins - install and configure Traefik plugins
- Raw YAML editor (Monaco/VS Code engine) for anything else

**Setup required** - this feature needs two things configured:

| Requirement | Details |
|-------------|---------|
| Mount `traefik.yml` read-write | `-v /path/to/traefik.yml:/app/traefik.yml` (no `:ro`) |
| Set `RESTART_METHOD` | How TM restarts Traefik after a config change - `proxy`, `poison-pill`, or `socket` |

See the [Static Config Editor](static.md) page for full setup instructions including how to configure each restart method.

---

## Multi-Server

Manage unlimited remote Traefik instances from one UI through [TMA](agent.md), a small Go agent that runs next to Traefik on each server. A switcher in the nav bar changes the active server, and every tab - routes, middlewares, services, backups, logs - then works against it. No VPN or SSH required.

The setup wizard generates a ready-to-paste Docker Compose or Docker Run command, and the API key is shown once and stored encrypted.

---

## Backups

Every change writes a timestamped backup first, and any of them can be restored in one click. Retention is configurable.

[Git backup](git-backup.md) additionally pushes your config to GitHub, Gitea, Forgejo, GitLab or any HTTPS remote, with commit history, side-by-side diffs and one-click restore of any commit. Agents can push to the Host's repository on their own branch, one branch per server, so a single repository covers every server.

---

## Visualizations

Optional tabs - toggle on in **Settings - Interface - Tabs** or during the setup wizard. No extra mounts needed.

| Tab                           | Description                                                                    |
| -------------------------------| --------------------------------------------------------------------------------|
| [Dashboard](tab-dashboard.md) | Routes grouped by category with app icons, custom groups, per-card editing, and one-click app launching |
| [Route Map](tab-routemap.md)  | Topology connection map - entry points → routes → middlewares → services       |
| [TLS Options](tab-tls-options.md) | Named `tls.options` profiles - min/max version, ciphers, mTLS - assignable per route |
| [CrowdSec](tab-crowdsec.md)   | Decisions and alerts from a CrowdSec LAPI; ban, captcha, bypass or unban with one click |

---

## Monitoring

Optional tabs - each requires a file mounted into the container.

| Tab | Mount required | Description |
|-----|----------------|-------------|
| [Certificates](tab-certs.md) | `acme.json:/app/acme.json:ro` | TLS certificates with expiry tracking. `ACME_JSON_PATH` accepts several files or a directory, for setups with one resolver per storage file |
| [Plugins](tab-plugins.md) | `traefik.yml:/app/traefik.yml:ro` | Plugins declared in your static config |
| [Logs](tab-logs.md) | `access.log:/app/logs/access.log:ro` | Live Traefik access log tail, with source-IP classification and an optional [world map](geoip.md) |

---

## Providers

Read-only tabs that pull live data from the Traefik API. No extra mounts needed - just a working API connection.

### Orchestrators

| Tab | Provider |
|-----|----------|
| [Docker](tab-docker.md) | `docker` |
| [Kubernetes](tab-kubernetes.md) | `kubernetesCRD` / `kubernetesIngress` / `kubernetesGateway` |
| [Swarm](tab-swarm.md) | `swarm` |
| [Nomad](tab-nomad.md) | `nomad` |
| [ECS](tab-ecs.md) | `ecs` |
| [Consul Catalog](tab-consulcatalog.md) | `consulCatalog` |

### Key-Value Stores

| Tab | Provider |
|-----|----------|
| [Redis](tab-redis.md) | `redis` |
| [etcd](tab-etcd.md) | `etcd` |
| [Consul KV](tab-consul.md) | `consul` |
| [ZooKeeper](tab-zookeeper.md) | `zooKeeper` |

### Config-based

| Tab | Provider |
|-----|----------|
| [HTTP Provider](tab-http_provider.md) | `http` |
| [File (external)](tab-file_external.md) | `file` |

> Traefik Manager's own routes are automatically excluded from the File provider tab.

---

## Configuration

| Page                                 | Description                                                                                   |
| --------------------------------------| -----------------------------------------------------------------------------------------------|
| [manager.yml](manager-yml.md)        | Full settings file reference - all keys, types, and defaults                                  |
| [Environment Variables](env-vars.md) | All supported environment variables with override behaviour                                   |
| [OIDC / SSO Login](oidc.md)          | Supports OpenID Connect (OIDC) as an additional login method alongside the built-in password. |
| [Notification Webhooks](webhooks.md) | Forward events to Discord, Slack, ntfy or any JSON endpoint |
| [Git Repository Backup](git-backup.md) | Auto-push, commit history, diff viewer and one-click restore |

---

## Operations

| Page | Description |
|------|-------------|
| [Reset Password](reset-password.md) | CLI reset, TOTP recovery, and manual reset via manager.yml |
| [Security](security.md) | Security controls, API keys, sessions, and hardening recommendations |
| [Traefik Hardening](hardening.md) | CVE advisories, header aliases, forwardAuth limits, and real client IPs |
| [Development](development.md) | Project layout, running the test suite, and what a pull request needs |

---

## Self Route

Put Traefik Manager itself behind Traefik so you can access it via a domain with HTTPS.

Go to **Settings - Connection - Self Route**. The URL field pre-fills from your current hostname and the service URL is detected from your existing config if a matching route is found. Click **Save Route** - TM writes the router and service entries into your dynamic config file. No changes to `traefik.yml` needed.

---

## Traefik provider config snippets

Minimal additions to your `traefik.yml` to enable each provider tab.

:::tabs
== Docker
```yaml
providers:
  docker:
    exposedByDefault: false
```

== Swarm
```yaml
providers:
  swarm:
    exposedByDefault: false
```

== Kubernetes
```yaml
providers:
  kubernetesCRD: {}
  kubernetesIngress: {}
```

== Nomad
```yaml
providers:
  nomad:
    endpoint:
      address: "http://nomad:4646"
```

== ECS
```yaml
providers:
  ecs:
    region: us-east-1
    clusters:
      - my-cluster
```

== Consul Catalog
```yaml
providers:
  consulCatalog:
    endpoint:
      address: "consul:8500"
    exposedByDefault: false
```

== Redis
```yaml
providers:
  redis:
    endpoints:
      - "redis:6379"
```

== etcd
```yaml
providers:
  etcd:
    endpoints:
      - "etcd:2379"
```

== Consul KV
```yaml
providers:
  consul:
    endpoints:
      - "consul:8500"
```

== ZooKeeper
```yaml
providers:
  zooKeeper:
    endpoints:
      - "zookeeper:2181"
```

== HTTP Provider
```yaml
providers:
  http:
    endpoint: "https://config.example.com/traefik"
    pollInterval: "30s"
```

== File (external)
```yaml
providers:
  file:
    directory: /etc/traefik/dynamic/
    watch: true
```

== Logs tab
```yaml
accessLog:
  filePath: "/logs/access.log"
  format: common
```
:::

---

## Mobile App

A companion Android app for managing Traefik Manager on the go. See the [requirements table](mobile.md#requirements) for which server version each app release needs.

Connect it with an API key: go to **Settings - Authentication - App / Mobile API Keys**, click **Add Key**, enter a device name, and copy the generated key. Each device gets its own key, so one can be revoked without affecting the others.

<div class="vp-grid-cards">
<div class="vp-card">

**<img src="/images/icon.png" style="height:24px;width:24px;vertical-align:middle;display:inline-block"> Traefik Manager Mobile**

Browse routes, middlewares, and services. Enable/disable routes. Add and edit with built-in templates. Follows system light/dark theme.

Authenticates via the API key from **Settings → Authentication**.

<MobileRelease /> [Mobile docs →](mobile.md)

</div>
</div>

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11 · Flask 3.1 · Gunicorn |
| Agent | Go 1.23 · Alpine Linux (TMA - remote agent daemon) |
| Config | ruamel.yaml (preserves comments and Go templates) |
| Auth | bcrypt · pyotp (TOTP) · Flask sessions · CSRF · Flask-Limiter · Fernet |
| Frontend | Vanilla JS · Tailwind CSS 3.4 · Phosphor Icons |
| Editor | Monaco Editor 0.52 (VS Code engine) |
| Route Map | dagre 0.8 (graph layout) |
| Geolocation | maxminddb · DB-IP Lite (local lookups, no external calls) |
| Tests | pytest · ruff · `go test` - run on every pull request |
| Container | Docker · Alpine Linux · all JS/CSS bundled at build time (no CDN at runtime) |
