from conftest import read_config, write_config, post_form


def _save_mw(client, name="auth-test", yaml_body=None, **extra):
    body = yaml_body or "basicAuth:\n  users:\n    - 'user:$apr1$abc'\n"
    form = dict(middlewareName=name, middlewareContent=body, mwProtocol="http")
    form.update(extra)
    return post_form(client, "/save-middleware", **form)


def test_save_middleware_writes_yaml(client):
    r = _save_mw(client)
    assert r.status_code < 400
    mws = read_config()["http"]["middlewares"]
    assert "auth-test" in mws
    assert "basicAuth" in mws["auth-test"]


def test_delete_middleware(client):
    _save_mw(client)
    r = post_form(client, "/delete-middleware/auth-test", mwProtocol="http")
    assert r.status_code < 400
    assert "auth-test" not in (read_config().get("http", {}).get("middlewares") or {})


def test_middleware_appears_in_api(client):
    _save_mw(client)
    r = client.get("/api/routes")
    assert r.status_code == 200
    names = [m["name"] for m in r.get_json()["middlewares"]]
    assert "auth-test" in names


def test_saving_a_middleware_preserves_other_middlewares(client):
    write_config(
        "http:\n"
        "  routers: {}\n"
        "  services: {}\n"
        "  middlewares:\n"
        "    keep-me:  # do not touch\n"
        "      compress: {}\n"
    )
    r = _save_mw(client, name="new-mw")
    assert r.status_code < 400

    mws = read_config()["http"]["middlewares"]
    assert "keep-me" in mws, "an unrelated middleware was dropped"
    assert "new-mw" in mws

    raw = open(__import__("conftest").DYNAMIC_PATH).read()
    assert "# do not touch" in raw, "comment lost on middleware save"


def test_invalid_yaml_is_rejected(client):
    r = _save_mw(client, name="bad-mw", yaml_body="this: [is: not: valid")
    assert r.status_code >= 400
    assert "bad-mw" not in (read_config().get("http", {}).get("middlewares") or {})
