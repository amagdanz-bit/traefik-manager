# Development

How the project is laid out, how to run it locally, and what is expected of a pull request.

For bug reports and feature requests see [CONTRIBUTING.md](https://github.com/chr0nzz/traefik-manager/blob/main/CONTRIBUTING.md).

## Project layout

```
app.py                  Flask app, routes, CLI
core/                   Shared logic, one module per concern
blueprints/             (planned) route modules
agent/                  TMA - the Go agent for remote servers
tests/                  pytest suite
templates/
    index.html          SPA shell, no application JS
    sections/           Navbar, stats bar, mobile menu
    tabs/               One file per tab
    modals/             Route, middleware, settings and other modals
static/
    css/app.css         All custom styles
    js/                 Application JS, one file per area
    vendor/             Third-party JS/CSS, bundled at image build
docs/                   This VitePress site
```

### `core/`

Shared logic lives here so it can be tested directly and imported without pulling in the Flask app. The modules form an acyclic graph, and it is worth keeping it that way:

```
env, crypto -> config -> agents_store -> settings -> backups, notifications,
                                                     traefik, agents_http, git,
                                                     geoip, crowdsec, self_route,
                                                     certs, routes_build, auth
```

| Module | Owns |
|---|---|
| `env` | Environment-derived paths and constants, logger |
| `crypto` | Fernet encryption for secrets at rest |
| `config` | YAML read/write, Go-template preservation, path safety |
| `agents_store` | `agents.yml` persistence, secrets encrypted |
| `settings` | `manager.yml` load/save, settings-derived paths |
| `auth` | `login_required`, `csrf_protect`, session and API-key checks |
| `routes_build` | Turning config into route objects, and merging them back |
| `backups` | Timestamped local backups and retention |
| `git` | Git backup: repo management, commits, pushes |
| `traefik` | Read-only Traefik API client |
| `agents_http` | HTTP client for remote agents |
| `notifications` | In-app log and webhook delivery |
| `geoip`, `crowdsec`, `certs`, `self_route` | Feature-specific helpers |

Two conventions exist because breaking them caused real bugs:

- **Import mutable module state as a module, not a name.** `CONFIG_PATHS` is rebound at runtime when a config file is created from the UI, so `from core.env import CONFIG_PATHS` captures a snapshot that never updates. Use `env.CONFIG_PATHS`.
- **Import `config` and `settings` under an alias** (`cfg_mod`, `settings_mod`). `config` and `settings` are extremely common local variable names, and a local silently shadows the module.

### `static/js/`

Classic scripts, loaded in order, no bundler and no ES modules. Around 287 functions are called from inline `onclick=` handlers in the templates, so **every top-level function must stay a global**. `init.js` loads last and holds the code that runs at load time; everything else is function declarations and self-contained state.

::: warning Tailwind purges what it cannot see
`tailwind.config.js` scans `templates/**/*.html` and `static/js/**/*.js`. Utility classes used only in JS-generated markup are purged if the file is not covered by those globs. Moving class-bearing markup to a new location means updating the glob - `tests/test_assets.py` fails if you forget.
:::

## Running locally

```bash
pip install -r requirements.txt
TRAEFIK_API_URL=http://your-traefik:8080 CONFIG_PATH=config/dynamic.yml python3 app.py
```

The UI is at `http://localhost:5000`. See [CONTRIBUTING.md](https://github.com/chr0nzz/traefik-manager/blob/main/CONTRIBUTING.md) for the full environment variable list and the Docker build.

## Tests

```bash
pip install -r requirements-dev.txt
pytest                    # Python suite
python -m pyflakes app.py core tests    # lint
cd agent && go test ./... # agent suite
```

The suite runs against a temporary config directory and never touches a real Traefik or your own config. It runs on every pull request, along with pyflakes and a build, vet and test of the Go agent.

### What is covered

| Area | What it asserts |
|---|---|
| `test_routes.py` | Route saves for HTTP, TCP and UDP; backend validation; the multi-backend safeguard; the mobile client contract, including that a backend edit preserves sticky, health checks and priority; comment preservation |
| `test_presets.py` | Security-headers and streaming presets, the ownership ledger, refuse-to-overwrite |
| `test_middlewares.py` | Middleware save and delete, unrelated middlewares preserved |
| `test_backups.py` | Backups created before a write and containing the previous content |
| `test_auth.py` | Login, logout, CSRF rejection, unauthenticated access |
| `test_core_*.py` | Each `core/` module directly, including git hardening and agent secret encryption |
| `test_acme_paths.py` | Single and multiple acme storage files |
| `test_endpoints.py` | Every `url_for()` target resolves; no duplicate routes |
| `test_assets.py` | Tailwind scans every file that emits utility classes |
| `test_css.py` | No unshrinkable `min-width`/`min-height` floors in `app.css`; `resize` always paired with a scroll context |
| `test_lint.py` | No undefined names; every `core` alias in `app.py` resolves |
| `test_ui_prefs.py` | Interface preferences round-trip through settings; unknown keys are dropped |

### Conventions

- **Assert the YAML, not the status code.** A `200` from `/save` proves nothing about what landed on disk. Load the written file and assert its structure - that is where config-corrupting bugs show up.
- **Add a test when you change the write path.** `/save`, middleware saves and backups are the code that touches someone's live proxy config.
- **A test that guards a bug should fail without the fix.** Check that it does before opening the PR.

## Pull requests

- **Target `dev`.** `main` is the released branch; a PR against it will be asked to retarget. A check enforces this.
- **One concern per PR.** Small, focused PRs get reviewed and merged quickly. A large refactor mixed with a fix is hard to review and hard to revert.
- **Say what you tested.** Especially for anything touching route or middleware saves. If you tested against a real Traefik, say which version.
- **Host and agent parity.** If a feature works on the Host it should work when a remote agent is selected. The write path is shared, but the read path often is not - check both.

### Code style

- **Python** - 4-space indent, single quotes, type hints on new functions. No formatter is enforced.
- **HTML/JS** - stay within the existing Tailwind and vanilla-JS patterns. No new frameworks.
- **CSS** - add rules to `static/css/app.css`. No inline styles unless the value is dynamic.
- **No comments.** Use clear names instead; the codebase follows this throughout.
- **No dead code.** pyflakes runs in CI and fails on unused imports.

## Releasing

Version numbers appear in five places, all of which must match:

| File | What |
|---|---|
| `app.py` | `APP_VERSION` |
| `static/sw.js` | `CACHE_NAME` - bump it or browsers serve stale assets |
| `agent/main.go` | `Version` |
| `static/openapi.yaml`, `docs/public/openapi.yaml` | `info.version`, and the two files must stay identical |
| `docs/.vitepress/config.ts` | the release list |

Releases are cut by merging `dev` into `main`, tagging `vX.Y.Z`, and publishing a GitHub Release. The tag push builds and pushes the Docker images; **publishing** the release builds the agent binaries, so a draft release does not produce them.
