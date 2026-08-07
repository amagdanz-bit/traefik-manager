# Services Tab

The **Services** tab shows all services registered in Traefik across every provider - `@file`, `@docker`, `@kubernetes`, and so on. It is a read-only view pulled live from the Traefik API.

## What it shows

- Service name and provider (e.g. `my-app@file`, `nginx@docker`)
- Status badge: Success, Warning, or Error
- HTTP, TCP, and UDP services

## Views

Toggle between **grid** (default) and **list** view using the button in the filter bar. List view shows a compact table with Status, Protocol, Name, Provider, Servers, and Used By columns.

In the [Modern layout](guide.md), grid view uses the redesigned card: the service name with its type and provider below it, a status dot on the icon, its backend server URLs (each with a copy button), and a footer line with the server count, healthy-server ratio, and sticky or health-check flags. The number of routes using the service sits at the footer's right. Clicking the card opens the service detail panel.

## Filtering 

- **Search** - filter by service name
- **Status buttons** - show All / Success / Warnings / Errors. A service Traefik reports as `enabled` counts as a warning when any of its backends is not `UP`, so the stat panel's **backends down** count and this filter always agree

## Requirements

No volume mounts required. Data is read directly from the Traefik API (`/api/http/services`, `/api/tcp/services`, `/api/udp/services`). The Traefik API URL must be configured in **Settings → Connection**.

## Notes

- This tab is always visible - it cannot be disabled
- Use the **Routes** tab to create and manage routes stored in `dynamic.yml`
