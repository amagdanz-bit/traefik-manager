from conftest import read_config, write_config, post_form, post_json


def _save_route(client, name="bk1"):
    return post_form(client, "/save", serviceName=name, subdomain=f"{name}.example.com",
                     protocol="http", scheme="http", targetIp="10.0.0.1",
                     targetPort="8080", certResolver="letsencrypt")


def test_save_creates_a_backup(client):
    _save_route(client)
    r = client.get("/api/backups")
    assert r.status_code == 200
    data = r.get_json()
    files = data if isinstance(data, list) else data.get("backups", data.get("files", []))
    assert len(files) >= 1, "no backup was created by a config save"


def test_manual_backup_create(client):
    r = post_json(client, "/api/backup/create", {})
    assert r.status_code < 400
    listing = client.get("/api/backups").get_json()
    files = listing if isinstance(listing, list) else listing.get("backups", listing.get("files", []))
    assert len(files) >= 1


def test_backup_captures_the_pre_save_state(client, app_module):
    import glob
    import os

    write_config(
        "http:\n"
        "  routers:\n"
        "    marker-route:\n"
        "      rule: Host(`marker.example.com`)\n"
        "      service: marker-service\n"
        "  services:\n"
        "    marker-service:\n"
        "      loadBalancer:\n"
        "        servers:\n"
        "          - url: http://10.0.0.99:80\n"
    )
    _save_route(client, "afterwards")

    assert "afterwards" in read_config()["http"]["routers"]

    backups = glob.glob(os.path.join(app_module.BACKUP_DIR, "*.bak"))
    assert backups, "no backup file was written before the save"
    assert any("marker-route" in open(b).read() for b in backups), \
        "no backup contains the pre-save content"
