import json

from conftest import post_form


def test_unauthenticated_api_is_not_ok(anon_client):
    r = anon_client.get("/api/routes")
    assert r.status_code != 200


def test_unauthenticated_save_is_rejected(anon_client):
    r = anon_client.post("/save", data={"serviceName": "x", "protocol": "http"})
    assert r.status_code != 200
    from conftest import read_config
    assert not (read_config().get("http", {}).get("routers") or {})


def test_authenticated_api_works(client):
    assert client.get("/api/routes").status_code == 200


def test_csrf_rejected_without_token(client):
    r = client.post("/save", data={"serviceName": "nocsrf", "subdomain": "n.example.com",
                                   "protocol": "http", "targetIp": "10.0.0.1",
                                   "targetPort": "80"})
    assert r.status_code == 403
    from conftest import read_config
    assert "nocsrf" not in (read_config().get("http", {}).get("routers") or {})


def test_csrf_rejected_with_wrong_token(client):
    r = client.post("/save", data={"serviceName": "badcsrf", "protocol": "http",
                                   "csrf_token": "wrong"},
                    headers={"X-CSRF-Token": "wrong"})
    assert r.status_code == 403


def test_health_is_public(anon_client):
    r = anon_client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json()["ok"] is True


def test_logout_clears_session(client):
    post_form(client, "/logout")
    assert client.get("/api/routes").status_code != 200


def test_client_ip_diagnostic_requires_auth(anon_client, client):
    assert anon_client.get("/api/diagnostics/client-ip").status_code != 200
    r = client.get("/api/diagnostics/client-ip")
    assert r.status_code == 200
    d = r.get_json()
    assert "effective_ip" in d and "proxy_hops" in d
    assert d["effective_class"] in ("public", "private", "cgnat", "loopback", "link-local", "unknown")
