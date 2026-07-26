import json

from conftest import read_config, write_config, post_form

BACKENDS = json.dumps({
    "servers": [
        {"scheme": "http", "host": "10.0.0.1", "port": "8080"},
        {"scheme": "http", "host": "10.0.0.2", "port": "8080"},
        {"scheme": "http", "host": "10.0.0.3", "port": "8080"},
    ],
    "sticky": {"enabled": True, "cookieName": "tm_sticky", "secure": True, "httpOnly": True},
    "healthCheck": {"enabled": True, "path": "/health", "interval": "10s", "timeout": "3s"},
    "priority": 42,
})


def _save_http(client, name="app1", **extra):
    form = dict(serviceName=name, subdomain=f"{name}.example.com", protocol="http",
                scheme="http", targetIp="10.0.0.1", targetPort="8080",
                certResolver="letsencrypt")
    form.update(extra)
    return post_form(client, "/save", **form)


def test_save_http_route_writes_yaml(client):
    r = _save_http(client)
    assert r.status_code < 400

    cfg = read_config()
    assert "app1" in cfg["http"]["routers"]
    assert "app1.example.com" in cfg["http"]["routers"]["app1"]["rule"]
    servers = cfg["http"]["services"]["app1-service"]["loadBalancer"]["servers"]
    assert servers[0]["url"] == "http://10.0.0.1:8080"


def test_save_tcp_route(client):
    """TCP reads targetIp/targetPort positionally: index 1 of the repeated field."""
    r = post_form(client, "/save", serviceName="db", subdomain="db", protocol="tcp",
                  targetIp=["", "10.0.0.9", ""], targetPort=["", "5432", ""])
    assert r.status_code < 400
    cfg = read_config()
    assert cfg["tcp"]["routers"]["db"]["rule"] == "HostSNI(`db.example.com`)"
    assert cfg["tcp"]["services"]["db-service"]["loadBalancer"]["servers"][0]["address"] == "10.0.0.9:5432"


def test_save_udp_route(client):
    """UDP reads targetIp/targetPort positionally: index 2 of the repeated field."""
    r = post_form(client, "/save", serviceName="dns", subdomain="dns", protocol="udp",
                  targetIp=["", "", "10.0.0.53"], targetPort=["", "", "53"])
    assert r.status_code < 400
    cfg = read_config()
    assert cfg["udp"]["services"]["dns-service"]["loadBalancer"]["servers"][0]["address"] == "10.0.0.53:53"


def test_multiple_backends_and_load_balancing(client):
    r = _save_http(client, backendsJsonHttp=BACKENDS)
    assert r.status_code < 400

    lb = read_config()["http"]["services"]["app1-service"]["loadBalancer"]
    assert len(lb["servers"]) == 3
    assert lb["sticky"]["cookie"]["name"] == "tm_sticky"
    assert lb["healthCheck"]["path"] == "/health"
    assert read_config()["http"]["routers"]["app1"]["priority"] == 42


def test_legacy_client_edit_preserves_backends_and_lb(client):
    """A mobile-style save posts only targetIp/targetPort. It must update the
    first backend without wiping backends 2-3, sticky, healthCheck or priority."""
    _save_http(client, backendsJsonHttp=BACKENDS)

    r = _save_http(client, targetIp="10.9.9.9", targetPort="9999",
                   isEdit="true", originalId="app1")
    assert r.status_code < 400

    cfg = read_config()
    lb = cfg["http"]["services"]["app1-service"]["loadBalancer"]
    assert "10.9.9.9:9999" in lb["servers"][0]["url"]
    assert len(lb["servers"]) == 3, "extra backends were wiped by a legacy save"
    assert lb["sticky"]["cookie"]["name"] == "tm_sticky"
    assert lb["healthCheck"]["path"] == "/health"
    assert cfg["http"]["routers"]["app1"]["priority"] == 42


def test_delete_route(client):
    _save_http(client)
    r = post_form(client, "/delete/app1")
    assert r.status_code < 400
    assert "app1" not in (read_config().get("http", {}).get("routers") or {})


def test_toggle_route_preserves_config(client, app_module):
    _save_http(client, backendsJsonHttp=BACKENDS)

    r = client.post("/api/routes/app1/toggle", json={"enable": False, "csrf_token": "testtoken"},
                    headers={"X-CSRF-Token": "testtoken"})
    assert r.status_code < 400
    assert "app1" not in (read_config().get("http", {}).get("routers") or {})

    r = client.post("/api/routes/app1/toggle", json={"enable": True, "csrf_token": "testtoken"},
                    headers={"X-CSRF-Token": "testtoken"})
    assert r.status_code < 400

    lb = read_config()["http"]["services"]["app1-service"]["loadBalancer"]
    assert len(lb["servers"]) == 3, "disable/enable lost backends"
    assert lb["sticky"]["cookie"]["name"] == "tm_sticky"


def test_api_routes_lists_saved_route(client):
    _save_http(client)
    r = client.get("/api/routes")
    assert r.status_code == 200
    names = [a["name"] for a in r.get_json()["apps"]]
    assert "app1" in names


def test_comments_survive_a_save(client):
    write_config(
        "# top level comment\n"
        "http:\n"
        "  routers:\n"
        "    existing:\n"
        "      rule: Host(`old.example.com`)  # inline note\n"
        "      service: existing-service\n"
        "  services:\n"
        "    existing-service:\n"
        "      loadBalancer:\n"
        "        servers:\n"
        "          - url: http://10.0.0.50:80\n"
    )
    r = _save_http(client, name="newroute")
    assert r.status_code < 400

    raw = open(__import__("conftest").DYNAMIC_PATH).read()
    assert "# top level comment" in raw, "ruamel round-trip dropped a comment"
    assert "# inline note" in raw
    assert "existing" in read_config()["http"]["routers"]
