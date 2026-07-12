# Traefik Security Hardening

Traefik Manager can configure several Traefik security controls from the UI. This page explains what they defend against and how to enable them. These harden **Traefik and your backends** - they are separate from [Traefik Manager's own security](security.md).

All of these apply to the Host and to remote agents (the Static Config editor and middleware wizards work the same for both).

---

## Header alias spoofing (underscore headers)

### The problem

Go - and therefore Traefik - treats `X-Auth-User` and `X_Auth_User` as two **different** headers. A forwardAuth middleware manages the dash form (`X-Auth-User`), but an attacker-supplied underscore variant (`X_Auth_User`) passes through untouched.

It becomes exploitable at the backend: CGI, WSGI (Python), PHP, and some application-server setups collapse both forms into the same variable (`HTTP_X_AUTH_USER`). The app can then read the attacker's `X_Auth_User` instead of the identity your auth server set - an authentication/identity bypass behind an otherwise correct forwardAuth setup (Authelia, Authentik, Gatekeeper, etc.).

### The fix: `underscoreHeadersStrategy`

Traefik added an entry point option (**Traefik 3.6.20 / 3.7.6 or newer**) that controls underscore headers before routing:

| Strategy | Behaviour                                                                             |
| ----------| ---------------------------------------------------------------------------------------|
| `keep`   | Forward underscore headers as-is (Traefik default).                                   |
| `delete` | Silently strip any request header whose name contains an underscore. **Recommended.** |
| `reject` | Reject any request carrying an underscore header with `400 Bad Request`.              |

**In Traefik Manager:** Settings - Static Config - Entry Points - edit the entry point that handles your external HTTPS traffic - set **Underscore Headers** to `Delete` (or `Reject`). Traefik Manager writes the option to whichever entry point you edit and only offers it when the running Traefik version supports it.

The entry point name is whatever you called it - `websecure`, `https`, `web`, etc. Using `websecure` as an example, it writes:

```yaml
entryPoints:
  websecure:   # your external HTTPS entry point, whatever its name
    address: ":443"
    http:
      underscoreHeadersStrategy: delete
```

If you use the forwardAuth wizards, enabling this is strongly recommended.

### Related: CVE-2026-39858

A separate but related flaw (**CVE-2026-39858**, CVSS 7.8) let underscore aliases of *forwarded* headers (e.g. `X_Forwarded_Proto`) bypass ForwardAuth entirely. This one is fixed only by **upgrading Traefik** to **2.11.43 / 3.6.14 / 3.7.0-rc.2 or newer**. Traefik Manager warns you when your running Traefik is affected.

---

## Encoded path characters

Ambiguous percent-encoded characters in a request path (e.g. `%2F` for `/`, `%2E` for `.`) can be used to sneak past path-based routing or access controls. Traefik sanitizes paths by default since 3.3.6 (removing `..`, `.`, and duplicate slashes), but rejecting ambiguous encoded characters is opt-in.

**Traefik 3.7+** provides an `encodedCharacters` middleware. Add it from Add Middleware - template **Encoded Characters** and attach it to sensitive routes. By default it rejects the dangerous set; you can explicitly allow specific characters if a backend needs them.

---

## ForwardAuth response size limit

A compromised or misbehaving auth server could return a very large response body to the forwardAuth subrequest. **Traefik 3.7+** adds `maxResponseBodySize` to cap it. The forwardAuth middleware wizards (including Authentik, Authelia, and Gatekeeper) expose this field - set a small limit (e.g. a few KB) since auth responses are tiny.

---

## Traefik security advisories

Traefik Manager checks your running Traefik version against a list of known security advisories and shows a warning when your Traefik is affected - with extra urgency when a forwardAuth middleware is configured, since those are the most exposed. Keep Traefik updated; the update-available badge in the navbar shows when a newer Traefik is out.
