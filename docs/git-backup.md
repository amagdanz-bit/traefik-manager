# Git Repository Backup

Traefik Manager can automatically push your Traefik configuration to a Git repository after every change, giving you a full version history, off-site backup, and one-click restore.

::: tip Remote agents
When a remote agent is active in the [server switcher](agent.md), the Backups - Git tab shows **that agent's** git backup. Agents can back up in two ways:

- **Use Host Repository** *(recommended)* - toggle it on in Backups - Git while the agent is active and pick a branch. The Host pushes that agent's config to the Host's repository using the Host's credentials - nothing to configure on the agent itself. Each server gets its own branch.
- **Autonomous** - the agent pushes on its own using its `GIT_BACKUP_*` environment variables, configured when adding the agent in Settings - Agents.
:::

::: warning One branch per server
Every server pushes its config to the same paths in the repository (`dynamic/`, `static/`). If two servers share the same repository **and** branch, they overwrite each other's files on every push. TM enforces a distinct branch per server when using the Host repository (e.g. `main` for the Host, `agent-vps1` for an agent); for autonomous agents, set a distinct `GIT_BACKUP_BRANCH` or a separate repository yourself.
:::

Supported platforms: GitHub, Gitea, Forgejo, GitLab, and any Git host accessible over HTTPS.

---

## Setup

**1. Create a private repository** on your preferred Git host. It can be empty - Traefik Manager will push to it on first use.

**2. Generate an access token** with write access to the repository:
- **GitHub**: Settings → Developer settings → Personal access tokens → Generate new token → scope: `repo`
- **Gitea / Forgejo**: Settings → Applications → Generate Token → scope: `repository`
- **GitLab**: Settings → Access Tokens → scope: `write_repository`

**3. Open Traefik Manager** → Settings → Backups → Git tab.

**4. Fill in the fields:**

| Field | Description |
|---|---|
| Repository URL | Full HTTPS URL, e.g. `https://github.com/user/traefik-backups.git` |
| Branch | Branch to push to (default: `main`) |
| Username | Your Git username (required for most hosts) |
| Token / Password | The access token you generated |
| Commit Message | Template - use `{action}` and `{timestamp}` as placeholders |
| Auto-push on save | Push automatically after every route, middleware, or static config change |

**5. Click "Test"** to verify the connection, then **"Save Git Settings"**.

**6. Enable Git Backup** using the toggle, then save.

**7. Click "Push Now"** to make the first push. The Git History section will populate with the commit.

---

## Auto-push behavior

When auto-push is enabled, Traefik Manager pushes to your repository in the background after any config change:

- Adding, editing, deleting, enabling, or disabling a **route** (including raw-YAML route edits)
- Adding, editing, or deleting a **middleware**
- Saving the **static config** (via the Static Config editor)

The push runs in a background thread and does not block the UI response. If the push fails (e.g. network error), a warning is logged but the config change is still saved locally.

Before each push, Traefik Manager fetches and syncs the local backup clone to the remote so the push always fast-forwards. This self-heals a clone that has diverged from the remote (which would otherwise reject every push). Concurrent pushes are serialized to avoid Git lock collisions during rapid changes.

If there are no changes since the last push (the files are identical), no commit is created.

---

## Manual commits with a message

If you prefer a clean, human-readable history over a commit per save, turn **Auto-push on save** off and commit manually:

1. Make your route, middleware, or static config changes.
2. Open Settings - Backups - Git.
3. Type a **Commit message** describing the change (optional - leave blank to use the commit message template).
4. Click **Push Now**.

The message is used for that push only and is then cleared. This works the same way for remote agents when one is active in the [server switcher](agent.md).

---

## Git History and restore

The **Git History** section shows the last 50 commits. For each commit you can:

- **View Diff** - see exactly which lines changed
- **Restore** - roll back to that commit's config

Restoring creates a local backup of the current config first (visible in the Routes or Static Config tabs), then writes the files from the selected commit.

---

## Commit message templates

The default template is:

```
traefik-manager: {action} at {timestamp}
```

Where `{action}` is the operation (e.g. `route save`, `middleware save`, `static config save`, `manual`) and `{timestamp}` is the current date and time.

Custom examples:
- `[TM] {action} - {timestamp}`
- `chore: traefik config update {timestamp}`

---

## What gets backed up

Traefik Manager backs up:

- All dynamic config files (`CONFIG_PATH`, `CONFIG_PATHS`, or `CONFIG_DIR`) - copied into `dynamic/`
- The static config (`STATIC_CONFIG_PATH`), if configured - copied into `static/`

The repository is organised into subfolders:

```
traefik-backups/
  dynamic/
    dynamic.yml        ← routes, middlewares, TLS options, services
    tls-options.yml    ← (if you use a separate file)
  static/
    traefik.yml        ← entrypoints, providers, resolvers
```

Dynamic config files contain everything you define through the Traefik file provider - including routes, middlewares, services, and `tls` options blocks. If you split them into multiple files (e.g. `routes.yml`, `middlewares.yml`, `tls.yml`), all files are backed up. TLS options defined inside any dynamic config file are included automatically.

---

## Docker setup

No extra configuration is needed. The `git` binary is included in the Traefik Manager Docker image.

The local clone lives inside the container at `{BACKUP_DIR}/git-repo/` (default: `/app/backups/git-repo/`). To persist it across container restarts, make sure your `BACKUP_DIR` is mounted as a volume:

```yaml
volumes:
  - /var/lib/traefik-manager/backups:/app/backups
```

---

## Native (Linux) setup

`git` must be installed on the host:

```bash
# Debian / Ubuntu
apt install git

# RHEL / Fedora
dnf install git
```

The local clone lives at `{BACKUP_DIR}/git-repo/` where `BACKUP_DIR` is the value of your `BACKUP_DIR` environment variable (default: `/app/backups`).

---

## Security notes

- The access token is stored encrypted in `manager.yml` using the same Fernet encryption used for other secrets (OIDC client secret, CrowdSec API key).
- The token is never returned by the API - only a `git_backup_token_set: true/false` flag is exposed.
- Use a token with the minimum required scope (repository write only). Do not use a full admin token.
- Use a **private** repository to keep your Traefik config off the public internet.
