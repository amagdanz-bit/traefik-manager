from conftest import read_config, write_config, post_form


def _save_with_headers_preset(client, name="jellyfin", **extra):
    form = dict(serviceName=name, subdomain=f"{name}.example.com", protocol="http",
                scheme="http", targetIp="10.0.0.1", targetPort="8096",
                certResolver="letsencrypt",
                headersPresetPresent="true", headersPresetEnabled="true")
    form.update(extra)
    return post_form(client, "/save", **form)


def test_headers_preset_creates_middleware_and_attaches_it(client):
    r = _save_with_headers_preset(client)
    assert r.status_code < 400

    cfg = read_config()
    mws = cfg["http"]["middlewares"]
    assert "jellyfin-headers" in mws, "preset did not create the middleware"
    assert "headers" in mws["jellyfin-headers"]
    assert "jellyfin-headers" in cfg["http"]["routers"]["jellyfin"]["middlewares"]


def test_headers_preset_is_recorded_in_the_ledger(client, app_module):
    _save_with_headers_preset(client)
    ledger = app_module.load_settings().get("managed_middlewares") or {}
    assert "jellyfin-headers" in ledger, "ownership ledger was not updated"


def test_preset_refuses_to_overwrite_a_hand_written_middleware(client):
    """The safety rule: a same-named middleware not in the ledger is never clobbered."""
    write_config(
        "http:\n"
        "  routers: {}\n"
        "  services: {}\n"
        "  middlewares:\n"
        "    jellyfin-headers:\n"
        "      headers:\n"
        "        customResponseHeaders:\n"
        "          X-Mine: handwritten\n"
    )
    r = _save_with_headers_preset(client)
    assert r.status_code == 409, "expected refuse-to-overwrite, got %s" % r.status_code

    cfg = read_config()
    mine = cfg["http"]["middlewares"]["jellyfin-headers"]["headers"]["customResponseHeaders"]
    assert mine["X-Mine"] == "handwritten", "hand-written middleware was clobbered"
    assert "jellyfin" not in (cfg["http"].get("routers") or {}), \
        "route was created even though the save was refused"


def test_disabling_the_preset_removes_the_middleware(client, app_module):
    _save_with_headers_preset(client)
    assert "jellyfin-headers" in read_config()["http"]["middlewares"]

    r = _save_with_headers_preset(client, headersPresetEnabled="false",
                                  isEdit="true", originalId="jellyfin")
    assert r.status_code < 400

    mws = read_config()["http"].get("middlewares") or {}
    assert "jellyfin-headers" not in mws, "preset middleware was not removed when disabled"
    ledger = app_module.load_settings().get("managed_middlewares") or {}
    assert "jellyfin-headers" not in ledger, "ledger entry left behind"


def test_streaming_preset_sets_transport_and_pass_host(client):
    r = post_form(client, "/save", serviceName="plex", subdomain="plex.example.com",
                  protocol="http", scheme="http", targetIp="10.0.0.2", targetPort="32400",
                  certResolver="letsencrypt",
                  streamingPresetPresent="true", streamingPresetEnabled="true")
    assert r.status_code < 400

    cfg = read_config()
    transport = cfg["http"]["serversTransports"]["plex-transport"]
    assert "forwardingTimeouts" in transport

    lb = cfg["http"]["services"]["plex-service"]["loadBalancer"]
    assert lb.get("passHostHeader", True) is True, \
        "streaming preset must not leave passHostHeader disabled"


def test_streaming_preset_composes_with_skip_tls_verify(client):
    """The transport must merge non-destructively, not replace."""
    r = post_form(client, "/save", serviceName="emby", subdomain="emby.example.com",
                  protocol="http", scheme="https", targetIp="10.0.0.3", targetPort="8920",
                  certResolver="letsencrypt", insecureSkipVerify="true",
                  streamingPresetPresent="true", streamingPresetEnabled="true")
    assert r.status_code < 400

    transport = read_config()["http"]["serversTransports"]["emby-transport"]
    assert transport.get("insecureSkipVerify") is True, "skip-TLS was lost"
    assert "forwardingTimeouts" in transport, "streaming timeouts were lost"
