import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

URL_FOR = re.compile(r"""url_for\(\s*['"]([^'"]+)['"]""")


def _sources():
    files = [os.path.join(ROOT, 'app.py')]
    for sub in ('core', 'templates', 'static/js'):
        base = os.path.join(ROOT, sub)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in ('vendor', '__pycache__')]
            for fn in filenames:
                if fn.endswith(('.py', '.html', '.js')):
                    files.append(os.path.join(dirpath, fn))
    return files


def _targets():
    found = {}
    for path in _sources():
        try:
            text = open(path, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        for m in URL_FOR.finditer(text):
            found.setdefault(m.group(1), set()).add(os.path.relpath(path, ROOT))
    return found


def test_every_url_for_target_is_registered(app_module):
    registered = {r.endpoint for r in app_module.app.url_map.iter_rules()}
    missing = {t: sorted(src) for t, src in _targets().items() if t not in registered}
    assert not missing, (
        'url_for() targets that do not resolve to a registered endpoint '
        '(a redirect using one of these raises BuildError at runtime):\n  '
        + '\n  '.join('%s  <- %s' % (t, ', '.join(s)) for t, s in sorted(missing.items()))
    )


def test_core_route_set_is_present(app_module):
    rules = {r.rule for r in app_module.app.url_map.iter_rules()}
    for rule in ('/', '/login', '/logout', '/save', '/save-middleware',
                 '/api/routes', '/api/routes/all', '/api/configs', '/api/health',
                 '/api/agents', '/api/backups', '/api/settings'):
        assert rule in rules, 'route %s disappeared' % rule


def test_no_duplicate_rules(app_module):
    seen = {}
    for r in app_module.app.url_map.iter_rules():
        for method in (r.methods or set()) - {'HEAD', 'OPTIONS'}:
            key = (r.rule, method)
            assert key not in seen, (
                'duplicate route: %s %s registered by both %s and %s'
                % (method, r.rule, seen[key], r.endpoint))
            seen[key] = r.endpoint


def test_dashboard_override_url_scheme_is_validated(client):
    payload = {'custom_groups': [], 'route_overrides': {
        'good':   {'url': 'https://app.example.com/admin', 'display_name': 'Good'},
        'evil':   {'url': 'javascript:alert(1)', 'display_name': 'Evil'},
        'data':   {'url': 'data:text/html,x'},
        'blank':  {'url': '   '},
    }}
    r = client.post('/api/dashboard/config', json=payload,
                    headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 200

    cfg = client.get('/api/dashboard/config').get_json()
    ov = cfg['route_overrides']
    assert ov['good']['url'] == 'https://app.example.com/admin'
    assert 'url' not in ov['evil']
    assert 'url' not in ov['data']
    assert 'url' not in ov['blank']
    assert ov['evil']['display_name'] == 'Evil'


def test_agent_visible_tabs_follow_the_hub(client):
    from core import agents_store
    agents_store.save_agents_file([
        {'id': 'ag1', 'name': 'Test Agent', 'url': 'http://10.0.0.5:8280', 'api_key': 'k'},
    ])
    r = client.put('/api/agents/ag1',
                   json={'visible_tabs': {'logs': True, 'certs': 0, 'bogus': True, 'docker': 'yes'}},
                   headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 200

    agents = client.get('/api/agents').get_json()['agents']
    ag = next(a for a in agents if a['id'] == 'ag1')
    assert ag['visible_tabs'] == {'logs': True, 'certs': False, 'docker': True}

    reloaded = agents_store.load_agents()
    assert reloaded[0]['visible_tabs'] == {'logs': True, 'certs': False, 'docker': True}


def test_toast_messages_are_recorded_in_the_drawer(client):
    r = client.post('/api/notifications/log',
                    json={'message': 'Route gone deleted', 'type': 'error'},
                    headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 200 and r.get_json()['stored'] is True

    entries = client.get('/api/notifications').get_json()
    assert any(e['msg'] == 'Route gone deleted' and e['type'] == 'error' for e in entries)


def test_the_same_message_is_not_recorded_twice(client):
    payload = {'message': 'Saved app1', 'type': 'success'}
    hdrs = {'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'}
    assert client.post('/api/notifications/log', json=payload, headers=hdrs).get_json()['stored'] is True
    assert client.post('/api/notifications/log', json=payload, headers=hdrs).get_json()['stored'] is False

    entries = client.get('/api/notifications').get_json()
    assert sum(1 for e in entries if e['msg'] == 'Saved app1') == 1


def test_empty_toast_messages_are_rejected(client):
    r = client.post('/api/notifications/log', json={'message': '   '},
                    headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 400


def test_recording_a_toast_requires_a_session(anon_client):
    r = anon_client.post('/api/notifications/log', json={'message': 'hi'},
                         headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code in (302, 401, 403)


def _static_providers_roundtrip(client, raw, payload):
    import json
    res = client.post('/api/static/section',
                      data=json.dumps({'action': 'set', 'section': 'providers',
                                       'name': '', 'data': payload, 'current_raw': raw}),
                      content_type='application/json',
                      headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert res.status_code == 200, res.data
    body = res.get_json()
    assert body.get('ok'), body
    return body['raw'], body.get('parsed') or {}


BARE_DOCKER = "providers:\n  docker: {}\n"


def test_turning_off_expose_by_default_is_written_to_the_file(client):
    raw, parsed = _static_providers_roundtrip(client, BARE_DOCKER, {
        'docker': True, 'dockerEndpoint': '', 'dockerExposedByDefault': False,
        'dockerWatch': True, 'file': False,
    })
    assert parsed['providers']['docker'].get('exposedByDefault') is False, (
        'Traefik defaults exposedByDefault to true, so turning it off must write the key.\n'
        'Leaving it out leaves every container auto-exposed.\n' + raw)
    assert 'exposedByDefault: false' in raw


def test_leaving_expose_by_default_on_does_not_write_the_key(client):
    raw, parsed = _static_providers_roundtrip(client, BARE_DOCKER, {
        'docker': True, 'dockerEndpoint': '', 'dockerExposedByDefault': True,
        'dockerWatch': True, 'file': False,
    })
    assert 'exposedByDefault' not in (parsed['providers']['docker'] or {}), raw


def _cs_lapi_stub(monkeypatch, capi_count, local_ip, local_origin='crowdsec'):
    """LAPI modelled on crowdsec v1.7.8 pkg/database/decisionfilter.go L82-102.

    limit and id_gt are honoured; unknown params are silently ignored, which is
    what made the old page= sweep return the same rows every time. The local
    decision sorts last by id, so only a cursor walk to the end reaches it.
    """
    import app as tm
    pool = [{'id': i + 1, 'origin': 'CAPI', 'value': f'10.0.{i // 256}.{i % 256}',
             'type': 'ban', 'scenario': 'capi', 'until': '2099-01-01T00:00:00Z'}
            for i in range(capi_count)]
    pool.append({'id': 999999, 'origin': local_origin, 'value': local_ip, 'type': 'ban',
                 'scenario': 'crowdsecurity/http-probing', 'until': '2099-01-01T00:00:00Z'})

    calls = []

    def fake(method, path, **kw):
        calls.append(path)
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(path).query)
        limit = int(q.get('limit', ['100'])[0])
        id_gt = int(q.get('id_gt', ['0'])[0])
        rows = sorted((d for d in pool if d['id'] > id_gt), key=lambda d: d['id'])
        return rows[:limit]

    monkeypatch.setattr(tm, '_cs_lapi_url', lambda: 'http://lapi:8080')
    monkeypatch.setattr(tm, '_cs_api_key', lambda: 'key')
    monkeypatch.setattr(tm, '_cs_request', fake)
    return calls


def test_local_decisions_survive_the_pagination_cap(client, monkeypatch):
    """Issue #130: a local decision past the old cap was unreachable."""
    ip = '45.148.10.125'
    _cs_lapi_stub(monkeypatch, capi_count=6000, local_ip=ip)

    res = client.get('/api/crowdsec/decisions')
    assert res.status_code == 200, res.data
    values = [d['value'] for d in res.get_json()]
    assert ip in values, (
        'A local decision sitting past the old cap was dropped, so the UI could '
        'never find it. See issue #130.')


def test_manually_added_decisions_are_found(client, monkeypatch):
    """Bans added through Traefik Manager carry origin "manual"."""
    ip = '198.51.100.7'
    _cs_lapi_stub(monkeypatch, capi_count=6000, local_ip=ip, local_origin='manual')

    res = client.get('/api/crowdsec/decisions')
    values = [d['value'] for d in res.get_json()]
    assert ip in values, 'a ban added from the UI past the cap was dropped'


def test_every_decision_is_returned(client, monkeypatch):
    """LAPI supports id_gt pagination, so there is no reason to cap at 5000."""
    _cs_lapi_stub(monkeypatch, capi_count=6000, local_ip='45.148.10.125')

    res = client.get('/api/crowdsec/decisions')
    assert len(res.get_json()) == 6001, 'the cursor walk stopped short of the full set'


def test_local_decisions_are_not_duplicated(client, monkeypatch):
    """The old page= sweep returned the same rows repeatedly, since LAPI ignores it."""
    _cs_lapi_stub(monkeypatch, capi_count=3, local_ip='45.148.10.125')

    res = client.get('/api/crowdsec/decisions')
    ids = [d['id'] for d in res.get_json()]
    assert len(ids) == len(set(ids)), 'the cursor walk returned a decision twice'
    assert ids.count(999999) == 1


def test_geoip_lookup_no_longer_truncates(client, monkeypatch):
    """The old ips[:2000] cap dropped everything past 2000 and still returned 200.

    With the decisions cap gone a real instance sends 25k+ IPs, so that silent
    truncation turned the geography map into an undisclosed 8% sample.
    """
    import app as tm
    monkeypatch.setattr(tm, '_geoip_enabled', lambda: True)
    monkeypatch.setattr(tm, '_geoip_reader', lambda: object())
    monkeypatch.setattr(tm, '_geoip_lookup',
                        lambda ip, reader: {'country_code': 'US', 'country': 'United States'})

    ips = ['10.0.%d.%d' % (i // 256, i % 256) for i in range(2500)]
    res = client.post('/api/geoip/lookup', json={'ips': ips},
                      headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert res.status_code == 200
    assert len(res.get_json()['results']) == 2500, 'lookups are being silently dropped'


def test_geoip_aggregate_returns_counts_and_codes(client, monkeypatch):
    """Aggregate mode powers the map exactly, without shipping per-IP objects."""
    import app as tm
    monkeypatch.setattr(tm, '_geoip_enabled', lambda: True)
    monkeypatch.setattr(tm, '_geoip_reader', lambda: object())

    def geo(ip, reader):
        return ({'country_code': 'US', 'country': 'United States'} if ip.startswith('10.')
                else {'country_code': 'DE', 'country': 'Germany'})
    monkeypatch.setattr(tm, '_geoip_lookup', geo)

    ips = ['10.0.0.%d' % i for i in range(30)] + ['8.8.8.%d' % i for i in range(12)]
    res = client.post('/api/geoip/lookup', json={'ips': ips, 'aggregate': True},
                      headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    body = res.get_json()

    assert body['counts']['US']['count'] == 30
    assert body['counts']['DE']['count'] == 12
    assert body['counts']['US']['country'] == 'United States'
    assert 'results' not in body, 'aggregate mode should not ship per-IP objects'
    assert body['codes']['10.0.0.5'] == 'US', 'the country filter needs per-IP codes'
    assert body['codes']['8.8.8.5'] == 'DE'
