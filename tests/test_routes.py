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


# ---- #122: backend validation ------------------------------------------------

def test_tcp_save_without_a_backend_is_rejected(client):
    """A single targetIp lands at index 0, which TCP does not read, so the old
    code wrote `address: ':'` and returned 200."""
    r = post_form(client, "/save", serviceName="badtcp", subdomain="badtcp",
                  protocol="tcp", targetIp="10.0.0.9", targetPort="5432")
    assert r.status_code == 400, "a TCP save with no reachable backend should be refused"
    cfg = read_config()
    assert "badtcp" not in (cfg.get("tcp", {}).get("routers") or {})


def test_udp_save_without_a_backend_is_rejected(client):
    r = post_form(client, "/save", serviceName="badudp", subdomain="badudp",
                  protocol="udp", targetIp="10.0.0.9", targetPort="53")
    assert r.status_code == 400
    assert "badudp" not in (read_config().get("udp", {}).get("routers") or {})


def test_http_save_without_a_backend_is_rejected(client):
    r = post_form(client, "/save", serviceName="badhttp", subdomain="badhttp.example.com",
                  protocol="http", scheme="http", targetPort="8080")
    assert r.status_code == 400
    assert "badhttp" not in (read_config().get("http", {}).get("routers") or {})


def test_no_route_ever_gets_an_empty_address(client):
    """Whatever a client sends, `address: ':'` must never reach the config."""
    for proto, port in (("tcp", "5432"), ("udp", "53")):
        post_form(client, "/save", serviceName=f"x{proto}", subdomain=f"x{proto}",
                  protocol=proto, targetIp="", targetPort=port)
    raw = open(str(__import__("conftest").DYNAMIC_PATH)).read()
    assert "address: ':'" not in raw and 'address: ":"' not in raw


def test_backends_json_alone_is_enough(client):
    """A client that sends only backendsJson must still be accepted."""
    r = post_form(client, "/save", serviceName="jsononly", subdomain="jsononly",
                  protocol="tcp",
                  backendsJsonTcp=json.dumps({"servers": [{"host": "10.0.0.7", "port": "6379"}]}))
    assert r.status_code < 400, r.data[:200]
    lb = read_config()["tcp"]["services"]["jsononly-service"]["loadBalancer"]
    assert lb["servers"][0]["address"] == "10.0.0.7:6379"


# ---- #123: subdomain handling -------------------------------------------------

def test_tcp_does_not_double_append_the_domain(client):
    """A fully qualified subdomain must be used as-is, matching HTTP."""
    r = post_form(client, "/save", serviceName="fqdn", subdomain="db.other.tld",
                  protocol="tcp", targetIp=["", "10.0.0.9", ""],
                  targetPort=["", "5432", ""])
    assert r.status_code < 400
    rule = read_config()["tcp"]["routers"]["fqdn"]["rule"]
    assert rule == "HostSNI(`db.other.tld`)", rule
    assert ".example.com" not in rule, "the base domain was appended to an FQDN"


def test_tcp_still_appends_the_domain_to_a_bare_label(client):
    r = post_form(client, "/save", serviceName="bare", subdomain="db",
                  protocol="tcp", targetIp=["", "10.0.0.9", ""],
                  targetPort=["", "5432", ""])
    assert r.status_code < 400
    assert read_config()["tcp"]["routers"]["bare"]["rule"] == "HostSNI(`db.example.com`)"


def test_http_and_tcp_treat_subdomains_the_same(client):
    """The inconsistency in #123: same input, same host, whichever protocol."""
    post_form(client, "/save", serviceName="hsame", subdomain="svc.other.tld",
              protocol="http", scheme="http", targetIp="10.0.0.1", targetPort="80")
    post_form(client, "/save", serviceName="tsame", subdomain="svc.other.tld",
              protocol="tcp", targetIp=["", "10.0.0.2", ""], targetPort=["", "443", ""])
    cfg = read_config()
    assert "svc.other.tld" in cfg["http"]["routers"]["hsame"]["rule"]
    assert "svc.other.tld" in cfg["tcp"]["routers"]["tsame"]["rule"]
    assert "other.tld.example.com" not in str(cfg)


# ---- mobile client contract --------------------------------------------------

def _mobile_save(client, proto, ip, port, **extra):
    """Exactly how the mobile app posts /save: targetIp/targetPort as a repeated
    field with the value in the slot for that protocol."""
    slot = {'http': 0, 'tcp': 1, 'udp': 2}[proto]
    ips, ports = ['', '', ''], ['', '', '']
    ips[slot], ports[slot] = ip, port
    return post_form(client, "/save", protocol=proto, targetIp=ips, targetPort=ports, **extra)


def test_mobile_shaped_save_works_for_every_protocol(client):
    for proto, ip, port, extra in (
            ('http', '10.0.0.1', '8080', dict(serviceName='mh', subdomain='mh.example.com', scheme='http')),
            ('tcp',  '10.0.0.9', '5432', dict(serviceName='mt', subdomain='mt')),
            ('udp',  '10.0.0.53', '53',  dict(serviceName='mu', subdomain='mu'))):
        r = _mobile_save(client, proto, ip, port, **extra)
        assert r.status_code < 400, '%s save failed: %s' % (proto, r.data[:200])

    cfg = read_config()
    assert cfg['http']['services']['mh-service']['loadBalancer']['servers'][0]['url'] == 'http://10.0.0.1:8080'
    assert cfg['tcp']['services']['mt-service']['loadBalancer']['servers'][0]['address'] == '10.0.0.9:5432'
    assert cfg['udp']['services']['mu-service']['loadBalancer']['servers'][0]['address'] == '10.0.0.53:53'


def test_mobile_edit_preserves_load_balancing(client):
    """The mobile app sends no backendsJson, so a save from it must leave extra
    backends, sticky and priority alone."""
    post_form(client, "/save", serviceName='multi', subdomain='multi.example.com',
              protocol='http', scheme='http', targetIp='10.0.0.1', targetPort='80',
              backendsJsonHttp=json.dumps({
                  'servers': [{'scheme': 'http', 'host': '10.0.0.1', 'port': '80'},
                              {'scheme': 'http', 'host': '10.0.0.2', 'port': '80'}],
                  'sticky': {'enabled': True, 'cookieName': 'keep'},
                  'priority': 42}))

    _mobile_save(client, 'http', '10.9.9.9', '99', serviceName='multi',
                 subdomain='multi.example.com', scheme='http',
                 isEdit='true', originalId='multi')

    cfg = read_config()
    lb = cfg['http']['services']['multi-service']['loadBalancer']
    assert '10.9.9.9:99' in lb['servers'][0]['url']
    assert len(lb['servers']) == 2, 'mobile edit wiped the second backend'
    assert lb['sticky']['cookie']['name'] == 'keep'
    assert cfg['http']['routers']['multi']['priority'] == 42
