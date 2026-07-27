"""Multiple acme storage files (#121).

Traefik writes one storage file per cert resolver, so a setup with several
resolvers has several files. ACME_JSON_PATH accepts a comma-separated list, and
any entry that is a directory contributes its .json files.
"""
import json
import os

from core import settings as settings_mod


def _set_acme(monkeypatch, value):
    monkeypatch.setenv('ACME_JSON_PATH', value)
    s = settings_mod.load_settings()
    if s.get('acme_json_path'):
        settings_mod.save_settings(
            domains=s['domains'], cert_resolver=s['cert_resolver'],
            traefik_api_url=s['traefik_api_url'], auth_enabled=s['auth_enabled'],
            password_hash=s['password_hash'], visible_tabs=s['visible_tabs'],
            acme_json_path='')


def test_single_path_still_works(monkeypatch):
    _set_acme(monkeypatch, '/etc/traefik/acme.json')
    assert settings_mod.get_acme_json_paths() == ['/etc/traefik/acme.json']


def test_comma_separated_paths(monkeypatch):
    _set_acme(monkeypatch, '/a/ovh.json, /a/lan.json ,/a/le.json')
    assert settings_mod.get_acme_json_paths() == ['/a/ovh.json', '/a/lan.json', '/a/le.json']


def test_duplicates_are_collapsed(monkeypatch):
    _set_acme(monkeypatch, '/a/x.json,/a/x.json')
    assert settings_mod.get_acme_json_paths() == ['/a/x.json']


def test_a_directory_contributes_its_json_files(monkeypatch, tmp_path):
    d = tmp_path / 'acme'
    d.mkdir()
    (d / 'ovh.json').write_text('{}')
    (d / 'lan.json').write_text('{}')
    (d / 'notes.txt').write_text('ignore me')
    _set_acme(monkeypatch, str(d))
    paths = settings_mod.get_acme_json_paths()
    assert [os.path.basename(p) for p in paths] == ['lan.json', 'ovh.json'], paths
    assert all(p.endswith('.json') for p in paths)


def test_directory_and_file_can_be_mixed(monkeypatch, tmp_path):
    d = tmp_path / 'acme'
    d.mkdir()
    (d / 'a.json').write_text('{}')
    _set_acme(monkeypatch, '%s,/elsewhere/manual.json' % d)
    got = settings_mod.get_acme_json_paths()
    assert os.path.basename(got[0]) == 'a.json'
    assert got[-1] == '/elsewhere/manual.json'


def test_certs_endpoint_merges_multiple_files(client, monkeypatch, tmp_path):
    """Certificates from every configured file appear, tagged with their source."""
    d = tmp_path / 'acme'
    d.mkdir()

    def _store(resolver, domain):
        return {resolver: {'Certificates': [{'domain': {'main': domain, 'sans': []},
                                             'certificate': ''}]}}
    (d / 'ovh.json').write_text(json.dumps(_store('ovh', 'a.example.com')))
    (d / 'lan.json').write_text(json.dumps(_store('lan', 'b.internal')))

    monkeypatch.setenv('ACME_JSON_PATH', str(d))
    r = client.get('/api/traefik/certs')
    assert r.status_code == 200
    certs = r.get_json().get('certs', [])
    mains = {c['main'] for c in certs}
    assert 'a.example.com' in mains and 'b.internal' in mains, certs
    resolvers = {c['resolver'] for c in certs}
    assert {'ovh', 'lan'} <= resolvers
    assert {c.get('source') for c in certs} >= {'ovh.json', 'lan.json'}


def test_certs_endpoint_with_a_single_file(client, monkeypatch, tmp_path):
    """The common case, and the one most existing installs use.

    Multi-file support reworked this code path, so the single-file behaviour is
    pinned explicitly rather than assumed to fall out of the list handling.
    """
    acme = tmp_path / 'acme.json'
    acme.write_text(json.dumps({
        'letsencrypt': {'Certificates': [
            {'domain': {'main': 'solo.example.com', 'sans': ['www.solo.example.com']},
             'certificate': ''},
        ]},
    }))
    monkeypatch.setenv('ACME_JSON_PATH', str(acme))

    r = client.get('/api/traefik/certs')
    assert r.status_code == 200
    body = r.get_json()
    certs = body.get('certs', [])
    assert [c['main'] for c in certs] == ['solo.example.com'], body
    assert certs[0]['resolver'] == 'letsencrypt'
    assert certs[0]['sans'] == ['www.solo.example.com']
    assert 'error' not in body, 'a working single-file setup reported an error: %r' % body.get('error')


def test_missing_single_file_reports_a_useful_error(client, monkeypatch, tmp_path):
    monkeypatch.setenv('ACME_JSON_PATH', str(tmp_path / 'nope.json'))
    r = client.get('/api/traefik/certs')
    assert r.status_code == 200
    body = r.get_json()
    assert body.get('certs') == []
    assert 'nope.json' in body.get('error', ''), body
    assert 'ACME_JSON_PATH' in body.get('error', '')


def test_empty_acme_file_is_not_an_error(client, monkeypatch, tmp_path):
    """Traefik writes an empty file before the first certificate is issued."""
    acme = tmp_path / 'acme.json'
    acme.write_text('')
    monkeypatch.setenv('ACME_JSON_PATH', str(acme))
    r = client.get('/api/traefik/certs')
    assert r.status_code == 200
    assert r.get_json().get('certs') == []
