# Plugins Tab

The **Plugins** tab shows Traefik plugins declared in the static `traefik.yml` configuration.

## What it shows

- Plugin name (your local alias)
- Module name (the plugin's Go module path)
- Version
- Settings (if any are configured)

In the [Modern layout](guide.md), this tab uses the redesigned card shared by the rest of the app, with the GitHub link, details, edit and remove actions in a hover rail, and a footer showing how many middlewares reference the plugin.

When the [Static Config tab](static.md) is enabled (i.e. `STATIC_CONFIG_PATH` is set and the file is mounted read-write), the Plugins tab gains **Add**, **Edit**, and **Delete** actions. Without it, plugins are read-only and must be managed by hand in `traefik.yml`.

## Installing a plugin

Click **Add Plugin** and paste the installation snippet from the [Traefik plugin catalog](https://plugins.traefik.io/):

1. **Static config snippet** - the `experimental.plugins` block from the plugin's page. TM backs up `traefik.yml` and merges the plugin declaration into it.
2. **Middleware snippet** *(optional)* - the plugin's example middleware. Replace the double-curly-brace template placeholders with real values and TM saves it to your dynamic config, ready to attach to a route. When a config directory or multiple config files are in use, a file selector chooses where the middleware is written - an existing file or a new one (default `plugin-middlewares.yml`). The same selector appears for agents, listing the agent's own config files.

After installing, a banner prompts you to restart Traefik so the plugin is downloaded and loaded.

## Enabling the tab

### During setup wizard
Toggle **Plugins** on in the "Optional monitoring" step.

### After setup
Go to **Settings → System Monitoring** and enable Plugins.

## Requirements

Point traefik-manager at your Traefik static config file via the `STATIC_CONFIG_PATH` environment variable (default: `/app/traefik.yml`).

:::tabs
== Docker / Podman
```yaml
volumes:
  - /path/to/traefik/traefik.yml:/app/traefik.yml:ro
```

== Linux (systemd)
```ini
Environment=STATIC_CONFIG_PATH=/etc/traefik/traefik.yml
```
:::

Plugins must be declared in your `traefik.yml`:

```yaml
experimental:
  plugins:
    my-plugin:
      moduleName: "github.com/example/my-plugin"
      version: "v1.2.3"
```

If the file is not found, the Plugins tab will display an error showing the path it expected and the env var to set.

> **Note:** The Plugins tab reads `experimental.plugins` from the static config. It shows what is *declared*, not what Traefik has loaded at runtime.
