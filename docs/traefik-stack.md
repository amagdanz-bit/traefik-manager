# Traefik Stack

Install Traefik and Traefik Manager with a single interactive command. The script asks what you want to install and how, then generates all required config files and starts the services.

```bash
curl -fsSL https://get-traefik.xyzlab.dev | bash
```

## Install modes

The first thing the script asks is what you want to install:

```
What would you like to install?
  1) Traefik + Traefik Manager (full stack)
  2) Traefik Manager only
  3) Traefik Manager Agent
```

If you choose **Traefik Manager only**, it then asks how to deploy it:

```
Deployment method
  1) Docker
  2) Linux service (systemd)
```

---

## Mode 1 - Traefik + Traefik Manager (full stack)

Installs both Traefik and Traefik Manager via Docker Compose. Best for a fresh server with nothing running yet.

### Prerequisites

- A Linux server (Debian/Ubuntu, RHEL/Fedora, or Arch)
- A domain name with DNS pointing to your server
- Ports 80 and 443 open for internet-facing deployments

### Sections and review screen

The setup runs through numbered sections (General, Deployment type, Domain, TLS / Certificates, Dynamic config, Optional mounts, CrowdSec, Docker network). After the last section a review table summarizes every answer:

```
  Review configuration
  ────────────────────────────────────────────────────────
   1  General             ~/traefik-stack
   2  Deployment type     external (internet-facing)
   3  Domain              example.com  dash:traefik.example.com  tm:manager.example.com
   4  TLS / Certificates  Let's Encrypt DNS (cloudflare)  you@example.com
   5  Dynamic config      Directory
   6  Optional mounts     logs certs static(restart:proxy)
   7  CrowdSec            install alongside
   8  Docker network      traefik-net  api:8080
  ────────────────────────────────────────────────────────

  Edit a section (1-8) or Enter to install:
```

Type a section number to re-configure it, then press Enter with no number to begin the install. Nothing is written to disk until you confirm.

### What the script configures

**Install directory** - where all files are created (default: `~/traefik-stack`)

**Deployment type**

- **External** - internet-facing, requires ports 80/443 open and DNS A records
- **Internal** - LAN, VPN, or Tailscale only

**Domain**

Your base domain and subdomains for:
- Traefik dashboard (default: `traefik.yourdomain.com`)
- Traefik Manager (default: `manager.yourdomain.com`)
- Whether to enable the Traefik API dashboard UI

**TLS / Certificates**

| Option                            | Description                                             |
| -----------------------------------| ---------------------------------------------------------|
| Let's Encrypt - HTTP challenge    | Port 80 must be open. Simplest for most setups.         |
| Let's Encrypt - DNS: Cloudflare   | Requires a Cloudflare API token. Works without port 80. |
| Let's Encrypt - DNS: Route 53     | Requires AWS access key and secret.                     |
| Let's Encrypt - DNS: DigitalOcean | Requires a DigitalOcean API token.                      |
| Let's Encrypt - DNS: Namecheap    | Requires Namecheap API user and key.                    |
| Let's Encrypt - DNS: DuckDNS      | Requires a DuckDNS token.                               |
| Let's Encrypt - DNS: deSEC        | Requires a deSEC token. Works without port 80.          |
| No TLS (HTTP only)                | Port 80 only. Suitable for internal LAN use.            |

**Dynamic config layout**

| Option | Description |
|---|---|
| Single file (`dynamic.yml`) | All routes in one file. Simpler to start with. |
| Directory (one `.yml` per service) | One file per service. Easier to manage at scale. |

**Optional mounts**

| Mount | Default | Enables |
|---|---|---|
| Access logs | Yes | Logs tab in Traefik Manager |
| SSL certs (`acme.json`) | Yes | Certs tab in Traefik Manager |
| Traefik static config (`traefik.yml`) | No | Plugins tab + Static Config settings in Traefik Manager |

**Docker network** - network name (default: `traefik-net`) and Traefik internal API port (default: `8080`)

**Static config editor** - if you enable the static config mount, the script also asks which restart method to use (socket proxy, poison pill, or direct socket). It then adds all required compose additions automatically - socket proxy service, shared signal volume, Traefik healthcheck, env vars on TM - so the Static Config editor works out of the box.

The Static Config settings covers:

| Section | What you can do |
|---------|-----------------|
| Entrypoints | Add, edit, and remove entrypoints - port, protocol, optional HTTP-to-HTTPS redirect |
| Certificate Resolvers | ACME email, storage path, DNS or HTTP challenge type |
| Plugins | Install and remove `experimental.plugins` entries |
| API | Enable/disable the Traefik API and Dashboard, insecure mode, and debug mode |
| Logging | Set log level (DEBUG / INFO / WARN / ERROR) and toggle access logging |
| Providers | Toggle Docker and File providers; add and remove other provider types (Swarm, HTTP, ECS, etc.) |
| Advanced | Full raw YAML editor (Monaco) for anything not covered by the sections above |

For existing installs that did not enable the static config editor during setup, you have two options:

- **Re-run setup.sh** - answer the static config questions differently. The script regenerates `docker-compose.yml` from your answers. Your config files and backups are preserved but any manual edits to the compose file will be overwritten.
- **Enable manually** - see [Enable static config editor](static-enable.md) to add just the required volume, env vars, and restart method to your existing compose without re-running setup.

**CrowdSec IDS** - optionally add CrowdSec intrusion detection to the stack.

| Option | What happens |
|---|---|
| Install as part of this stack | Adds a `crowdsec` service to the compose, generates a random bouncer API key, writes `crowdsec/acquis.yaml` pointing at the Traefik access log, and injects `CROWDSEC_LAPI_URL` + `CROWDSEC_API_KEY` into Traefik Manager automatically. |
| Connect to existing instance | Prompts for the LAPI URL and API key of a CrowdSec instance you are already running. Injects both into Traefik Manager. No new service is added to the compose. |

Choosing the install option with access logs disabled will automatically enable the access log mount - CrowdSec needs it to detect intrusions.

Once installed, enable the **CrowdSec** tab in Traefik Manager under Settings to view active decisions, recent alerts, and unban IPs.

### Directory structure

```
~/traefik-stack/
- docker-compose.yml
- traefik/
  - traefik.yml
  - acme.json
  - logs/
    - access.log
  - config/
    - dynamic.yml        (single file layout)
    - *.yml              (directory layout)
- traefik-manager/
  - config/
  - backups/
- crowdsec/              (only if CrowdSec install mode chosen)
  - acquis.yaml
```

### DNS records

Create A records before running the script so Let's Encrypt can issue certificates:

```
traefik.yourdomain.com  A  <server-ip>
manager.yourdomain.com  A  <server-ip>
```

### Updating

```bash
cd ~/traefik-stack
docker compose pull
docker compose up -d
```

### Useful commands

```bash
cd ~/traefik-stack
docker compose logs -f traefik-manager
docker compose down
docker compose restart
```

---

## Mode 2 - Traefik Manager only (Docker)

Installs just Traefik Manager as a Docker container. Use this when Traefik is already running on your server.

### Sections and review screen

The setup runs through numbered sections (General, Network, Access, Dynamic config, Optional mounts) and ends with a review table where you can re-configure any section by number before anything is installed - the same flow as the other modes:

```
  Edit a section (1-5) or Enter to install:
```

### What the script configures

**Install directory** - where files are created (default: `~/traefik-manager`)

**Network**

- Connect to an existing Traefik Docker network (e.g. `traefik-net`) or create a new one

**Access**

- **Via Traefik labels** - expose Traefik Manager through your existing Traefik instance with a domain and TLS certificate (same TLS options as full stack mode)
- **Direct port** - expose a host port (default: 5000) without needing Traefik labels

**Dynamic config layout** - single file or directory, same options as the full stack mode

**Optional mounts** - you provide the host paths to your existing Traefik files:

| Mount | Default | Path asked |
|---|---|---|
| Access logs | Yes | Path to Traefik access log (default: `/var/log/traefik/access.log`) |
| SSL certs (`acme.json`) | Yes | Path to `acme.json` (default: `/etc/traefik/acme.json`) |
| Traefik static config | No | Path to `traefik.yml` (default: `/etc/traefik/traefik.yml`) |

**Static config editor** - if you mount the static config, the script also asks:
- Which restart method to use (socket proxy, poison pill, or direct socket)
- The Traefik container name (default: `traefik`)

To add static config support to an existing install, either re-run `setup.sh` (regenerates the compose file from your answers, preserving config/backups) or follow [Enable static config editor](static-enable.md) to add only the required changes manually.

**CrowdSec** - optionally connect Traefik Manager to a CrowdSec instance you are already running. The script prompts for the LAPI URL and API key and injects `CROWDSEC_LAPI_URL` and `CROWDSEC_API_KEY` into the generated compose file. Once set, enable the **CrowdSec** tab in Traefik Manager under Settings. You can also configure this after install via **Settings → System Monitoring → CrowdSec** or by setting the env vars manually.

### Directory structure

```
~/traefik-manager/
- docker-compose.yml
- config/
  - dynamic.yml          (or config directory)
- backups/
```

### Updating

```bash
cd ~/traefik-manager
docker compose pull
docker compose up -d
```

---

## Mode 3 - Traefik Manager only (Linux service)

Installs Traefik Manager as a native systemd service. No Docker required. Use this when you are running Traefik natively or prefer not to use containers.

### Prerequisites

- Python 3.11 or newer
- `git`
- `systemd`

### Sections and review screen

The setup runs through numbered sections (General, Service user, Dynamic config, Optional mounts) and ends with a review table where you can re-configure any section by number before anything is installed - the same flow as the other modes:

```
  Edit a section (1-4) or Enter to install:
```

### What the script configures

- **Install directory** - where the app is cloned (default: `/opt/traefik-manager`)
- **Data directory** - where config and backups are stored (default: `/var/lib/traefik-manager`)
- **Port** - default: 5000
- **Dedicated system user** - creates a `traefik-manager` system user to run the service (recommended)
- **Dynamic config layout** - single file or directory; asks for the path to the file or directory

**Optional mounts** - asks for host paths to each:

| Mount | Default | Path asked |
|---|---|---|
| SSL certs (`acme.json`) | Yes | Path to `acme.json` (default: `/etc/traefik/acme.json`) |
| Access logs | Yes | Path to Traefik access log (default: `/var/log/traefik/access.log`) |
| Traefik static config | No | Path to `traefik.yml` (default: `/etc/traefik/traefik.yml`) |

**Static config editor** - if you mount the static config, the script also asks:

To add static config support to an existing native install, either re-run `setup.sh` (clones/updates the repo and regenerates the systemd unit) or follow [Enable static config editor](static-enable.md) to add the env vars manually.

**CrowdSec** - optionally connect Traefik Manager to a running CrowdSec instance. The script prompts for the LAPI URL and API key and writes `CROWDSEC_LAPI_URL` and `CROWDSEC_API_KEY` into the systemd unit file. You can also set them after install via **Settings → System Monitoring → CrowdSec** or by editing the unit file directly (`sudo systemctl edit traefik-manager`).

- **Restart method** - two options for native installs:
  - *Poison pill* (recommended) - writes a signal file; no Docker socket needed
  - *Direct Docker socket* - requires the `traefik-manager` user to be in the `docker` group
- **Traefik container name** (default: `traefik`)
- **Signal file path** if poison pill is chosen (default: `/var/lib/traefik-manager/signals/restart.sig`)

The script clones the repository, creates a Python venv, installs dependencies, writes a systemd unit file, and enables the service.

### Useful commands

```bash
sudo systemctl status traefik-manager
sudo journalctl -u traefik-manager -f
sudo systemctl restart traefik-manager
```

### Updating

```bash
cd /opt/traefik-manager
git pull
venv/bin/pip install -q -r requirements.txt gunicorn
sudo systemctl restart traefik-manager
```

---

## Mode 4 - Traefik Manager Agent

Installs the [TMA agent](agent.md) on a remote server so a central Traefik Manager can manage it. This mode does not install TM itself.

### Install methods

After choosing **Traefik Manager Agent**, the script shows an arrow-key menu:

```
Install method
▸ Docker - Agent only (alongside existing Traefik)
  Docker - Agent + Traefik (deploy both together)
  Binary - Agent only (systemd service, no Docker)
```

Use `↑`/`↓` to move, `Enter` to select, or type a number.

### Sections and review screen

After answering each section the script shows a review table:

```
  Review configuration
  ────────────────────────────────────────────────────────
   1  Install method     Agent only
   2  API key            sk-••••••••
   3  Traefik connection http://traefik:8080
   4  Optional paths     logs
   5  Restart method     none
   6  CrowdSec           disabled
   7  Git backup         disabled
   8  Install location   /opt/traefik-manager-agent  :8090
  ────────────────────────────────────────────────────────

  Edit a section (1-8) or Enter to install:
```

Type a section number to re-configure it, then press Enter to return to the review. Press Enter with no number to begin the install.

### What the script asks

**Traefik connection (section 3)**
- Traefik API URL (default: `http://traefik:8080`)
- Dynamic config path (default: `/app/config`)
- Skip TLS verification - shown only when the URL starts with `https://`; enables `TRAEFIK_INSECURE_SKIP_VERIFY` for self-signed or Cloudflare Origin certs
- Mount static config (`traefik.yml`) - toggle; if enabled, asks for the path

**Traefik install (Docker - Agent + Traefik only)**
- Enable HTTPS on port 443
- TLS certificate method: Let's Encrypt HTTP challenge, Let's Encrypt Cloudflare DNS, or no TLS
- ACME email (if Let's Encrypt)
- Cloudflare DNS API token (if Cloudflare DNS)
- Cert resolver name (default: `letsencrypt`)
- Enable Traefik dashboard and hostname
- Docker network name (default: `traefik-net`)

**Optional paths (section 4)**
- Mount ACME / certs (`acme.json`) - toggle + path
- Mount access logs - toggle + path
- Mount plugins directory - toggle + path

**Restart method (section 5)**
- None, socket proxy, poison pill, or direct Docker socket

**CrowdSec (section 6)**

| Option | What it does |
|---|---|
| None | Skip CrowdSec |
| Install alongside agent | Adds a `crowdsec` service to the compose, generates a random bouncer key, writes `crowdsec/acquis.yaml`. Requires access log mount (prompts if not set). Available for Docker installs only. |
| Connect to existing | Enter LAPI URL and API key. |

**Git backup (section 7)** - repo URL, branch, username, token, auto-push toggle

**Install location (section 8, Docker only)** - install directory and agent port (default: `8090`)

### Docker - Agent only output

Generates `docker-compose.yml` with only the env vars and volumes for the options you enabled, then runs `docker compose up -d`. If CrowdSec install was chosen, adds a `crowdsec` service and writes `crowdsec/acquis.yaml`.

### Docker - Agent + Traefik output

Creates the following directory structure and starts both containers:

```
/opt/traefik-manager-agent/
  docker-compose.yml           (traefik + traefik-manager-agent services)
  traefik/
    traefik.yml                (static config - entrypoints, file provider, cert resolver)
    acme.json                  (created empty, chmod 600 - if TLS enabled)
    config/                    (dynamic config dir, shared between Traefik and agent)
    logs/
      access.log
  crowdsec/                    (only if CrowdSec install chosen)
    acquis.yaml
```

Traefik's API port (8080) is not exposed externally - the agent reaches it via the internal Docker network (`http://traefik:8080`).

### Binary output

Downloads the `tma` binary from GitHub Releases and writes a systemd unit with all `Environment=` lines, then runs `systemctl enable --now tma`.

### Useful commands

**Docker:**
```bash
cd /opt/traefik-manager-agent
docker compose logs -f
docker compose pull && docker compose up -d
```

**Binary:**
```bash
sudo systemctl status tma
sudo journalctl -u tma -f
sudo systemctl restart tma
```

### Next steps after install

1. In TM Settings - Agents, click **Add Agent**
2. Enter the agent URL (e.g. `http://server-ip:8090`) and the API key
3. Use the **server switcher** in the TM nav bar to switch to this agent

---

## First login

Once the script completes it prints a temporary password:

```
Temporary password  abc123xyz
```

If it is not shown, retrieve it from the logs:

:::tabs
== Docker
```bash
docker logs traefik-manager | grep -A3 "AUTO-GENERATED"
```
== Linux service
```bash
sudo journalctl -u traefik-manager | grep -A3 "AUTO-GENERATED"
```
:::

Log in with the temporary password. On your next login you will be redirected to a forced password-change screen before you can access the dashboard.
