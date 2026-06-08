# Traefik Manager Agent (TMA)

TMA is a lightweight Go daemon that runs alongside Traefik on a remote server. It exposes an HTTP API on port 8090 that lets a central Traefik Manager instance manage the remote server's routes, config files, backups, and more - without needing direct access to the Traefik API or config files.

## How it works

1. Install TMA on each remote server (alongside Traefik)
2. In TM Settings - Agents, click **Add Agent** and enter the agent's URL
3. TM generates an API key - save it and set it as `TMA_API_KEY` in the agent's environment
4. Use the **server switcher** in the TM navigation bar to switch between local and remote servers

When a remote agent is active:

- **Routes and Middlewares** - All data tabs show that server's data. You can add, edit, delete, and toggle routes and middlewares on the remote server exactly as you would locally - changes are written to the agent's config files via the agent API.
- **Static Config** (Settings - Static Config) - If the agent has `STATIC_CONFIG_PATH` configured, the static config editor becomes available. Raw YAML editing is supported; section-based editing (entrypoints, cert resolvers, etc.) requires local TM. Restart Traefik works if the agent has a `RESTART_METHOD` set.
- **Backups** (Settings - Backups) - Dynamic Config and Git backup tabs show the agent's backups. All backup, restore, and git history operations are proxied through the agent. Git backup configuration fields are hidden for agents (managed via `GIT_BACKUP_*` env vars). The Static Config backup sub-tab is not shown for agents.
- **Settings** (all other panels) - Always refers to local TM configuration.

## Install via installer script

The fastest way is to use the `traefik-stack` installer with the agent option pre-selected:

```bash
curl -fsSL https://get-traefik.xyzlab.dev | bash
```

Choose **Traefik Manager Agent** from the menu. Or, to skip the menu entirely:

```bash
export TMA_INSTALL=1
curl -fsSL https://get-traefik.xyzlab.dev | bash
```

The installer asks for your API key and all path/feature options, then generates a `docker-compose.yml` (or systemd unit for binary installs) and starts the agent.

## Install via Docker manually

```yaml
services:
  traefik-manager-agent:
    image: ghcr.io/chr0nzz/traefik-manager-agent:latest
    restart: unless-stopped
    ports:
      - "8090:8090"
    environment:
      - TMA_API_KEY=your-api-key-here
      - TRAEFIK_API_URL=http://traefik:8080
      - CONFIG_PATH=/app/config
      # Optional - enable static config editing:
      - STATIC_CONFIG_PATH=/etc/traefik/traefik.yml
      # Optional - enable Traefik restart:
      - RESTART_METHOD=proxy
      - TRAEFIK_CONTAINER=traefik
      - DOCKER_HOST=tcp://socket-proxy:2375
    volumes:
      - /host/config:/app/config
      - /etc/traefik/traefik.yml:/etc/traefik/traefik.yml
```

## Install via binary

Download the binary for your platform from the [GitHub Releases](https://github.com/chr0nzz/traefik-manager/releases) page (`tma-linux-amd64`, `tma-linux-arm64`, etc.) and create a systemd unit:

```ini
[Unit]
Description=Traefik Manager Agent
After=network.target

[Service]
Environment=TMA_API_KEY=your-api-key-here
Environment=TRAEFIK_API_URL=http://traefik:8080
Environment=CONFIG_PATH=/app/config
ExecStart=/usr/local/bin/tma
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tma
```

## Environment variables

### Required

| Variable | Description |
|---|---|
| `TMA_API_KEY` | API key generated in TM Settings - Agents |

### Traefik connection

| Variable | Default | Description |
|---|---|---|
| `TRAEFIK_API_URL` | `http://traefik:8080` | Traefik API URL. Use `http://traefik:8080` when TMA runs alongside Traefik on the same Docker network, or a public HTTPS URL for a remote Traefik instance. |
| `TRAEFIK_INSECURE_SKIP_VERIFY` | `false` | Skip TLS certificate verification for HTTPS Traefik API URLs. Useful when using a self-signed cert or Cloudflare Origin Certificate. |
| `CONFIG_PATH` | `/app/config` | Dynamic config directory or file |
| `STATIC_CONFIG_PATH` | - | Path to `traefik.yml` - enables static config R/W |

### Optional paths

| Variable | Default | Description |
|---|---|---|
| `ACME_JSON_PATH` | - | Path to `acme.json` - enables cert info reads |
| `ACCESS_LOG_PATH` | - | Path to Traefik access log file |
| `PLUGINS_DIR` | - | Path to Traefik plugins directory |

### Traefik restart

| Variable | Default | Description |
|---|---|---|
| `RESTART_METHOD` | - | `proxy`, `poison-pill`, or `socket` |
| `TRAEFIK_CONTAINER` | `traefik` | Container name (used by `proxy` and `socket` methods) |
| `DOCKER_HOST` | - | e.g. `tcp://socket-proxy:2375` (used by `proxy` method) |
| `SIGNAL_FILE_PATH` | - | e.g. `/signals/restart.sig` (used by `poison-pill` method) |

### CrowdSec

| Variable | Default | Description |
|---|---|---|
| `CROWDSEC_LAPI_URL` | - | CrowdSec LAPI URL (e.g. `http://crowdsec:8080`) |
| `CROWDSEC_API_KEY` | - | CrowdSec bouncer API key |

### Git backup

| Variable | Default | Description |
|---|---|---|
| `GIT_BACKUP_ENABLED` | `false` | Enable autonomous git backup |
| `GIT_BACKUP_REPO` | - | HTTPS git repository URL |
| `GIT_BACKUP_BRANCH` | `main` | Branch to push to |
| `GIT_BACKUP_USERNAME` | - | Git username |
| `GIT_BACKUP_TOKEN` | - | Git access token |
| `GIT_BACKUP_COMMIT_MESSAGE` | `traefik-manager: {action} at {timestamp}` | Commit message template |
| `GIT_BACKUP_AUTO_PUSH` | `true` | Push after every config write |

### Agent server

| Variable | Default | Description |
|---|---|---|
| `TMA_PORT` | `8090` | Listening port |
| `TMA_RATE_LIMIT` | `10` | Requests per minute per IP (0 = disabled) |

## Storage

Agent registrations (name, URL, encrypted API key, and configuration) are stored in `agents.yml` in the same config directory as `manager.yml` (default `/app/config/agents.yml`). The file is created automatically when the first agent is added. If you are upgrading from a version before v1.5.0, agents are migrated automatically from `manager.yml` to `agents.yml` on first start - no manual action required.

Back up `agents.yml` alongside `manager.yml` to preserve agent registrations.

## Security

- The API key is the only credential - keep it secret and use HTTPS between TM and TMA
- Put TMA behind a reverse proxy (Traefik itself) with TLS for production use
- `TMA_RATE_LIMIT` protects against abuse; increase it if TM is making many calls per minute
- The `/health` endpoint is public (no auth required) - use it for uptime monitoring

## Updating

**Docker:**
```bash
cd /opt/traefik-manager-agent
docker compose pull && docker compose up -d
```

**Binary:**
```bash
curl -fsSL https://github.com/chr0nzz/traefik-manager/releases/latest/download/tma-linux-amd64 \
  -o /usr/local/bin/tma && chmod +x /usr/local/bin/tma
sudo systemctl restart tma
```

## Agent git backup

When `GIT_BACKUP_ENABLED=true`, the agent handles its own git backup cycle autonomously using the `GIT_BACKUP_*` env vars. You do not configure agent git backup through the TM Settings UI - the Settings - Agents wizard generates the Docker Compose with all env vars pre-filled based on your inputs.

When an agent is active in the TM server switcher, Settings - Backups shows the agent's backup data:

- **Dynamic Config tab** - lists and restores the agent's local backups
- **Git tab** - shows the agent's git history, status, and allows manual push and git restore; git configuration fields are hidden (managed by env vars on the agent)
- **Static Config tab** - not shown for agents (static config is part of the regular backup)

See [API Reference - Agent](api-agent.md) for the full endpoint list.
