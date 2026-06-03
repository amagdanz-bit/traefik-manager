# TLS Options Tab

The **TLS Options** tab manages `tls.options` profiles in your dynamic config. These profiles control TLS version, cipher suites, curve preferences, and client authentication for routers that reference them.

Enable this tab via **Settings - Interface - TABS - TLS Options**.

## What it shows

A card per named TLS options profile defined across all mounted config files. Each card shows the profile name, key settings (min version, SNI strict, cipher count), the raw YAML block, and edit/delete buttons.

## Creating a profile

Click **Add TLS Profile** and fill in:

| Field | Description |
|---|---|
| Profile Name | The key used in `tls.options` and referenced in router configs (e.g. `modern`, `strict`, `default`). Cannot be changed after creation. |
| Min TLS Version | Minimum allowed TLS version. Recommended: `VersionTLS12`. |
| Max TLS Version | Maximum allowed TLS version. Leave blank for no upper bound. |
| SNI Strict | Reject connections with no or mismatched SNI. Requires non-wildcard certificates. |
| Cipher Suites | One cipher per line. Leave empty to use Traefik defaults. Only applies to TLS 1.0-1.2 (TLS 1.3 ciphers are not configurable). |
| Curve Preferences | ECDH curve names, one per line (e.g. `X25519`, `CurveP256`). Leave empty for Traefik defaults. |
| ALPN Protocols | Application-layer protocols (e.g. `h2`, `http/1.1`). Leave empty for Traefik defaults. |
| Client Auth Type | Enables mTLS. Options: `NoClientCert`, `RequestClientCert`, `RequireAnyClientCert`, `VerifyClientCertIfGiven`, `RequireAndVerifyClientCert`. |
| CA Files | Paths to CA certificate files inside the container. Required when client auth type requires verification. |

## Example - hardened modern profile

```yaml
tls:
  options:
    modern:
      minVersion: VersionTLS12
      sniStrict: true
      cipherSuites:
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
      curvePreferences:
        - X25519
        - CurveP256
        - CurveP384
```

## Assigning a profile to a router

In the **Add / Edit Route** form, select a profile from the **TLS Options Profile** dropdown (visible when a cert resolver is selected). TM writes `tls.options: <name>` to the router config.

Traefik documentation: [TLS Options](https://doc.traefik.io/traefik/reference/routing-configuration/http/tls/tls-options/)
