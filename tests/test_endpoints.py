"""Every url_for() target must resolve to a registered endpoint.

Blueprints namespace endpoints ('login' becomes 'auth.login'), so moving a route
into a blueprint silently breaks every url_for that still uses the bare name.
Those are plain strings: pyflakes cannot see them, and the failure only appears
when a user hits that particular redirect.

This test extracts every url_for target from the Python and the templates and
checks it against the real url_map.
"""
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
    """Pin the endpoints users and the mobile app depend on."""
    rules = {r.rule for r in app_module.app.url_map.iter_rules()}
    for rule in ('/', '/login', '/logout', '/save', '/save-middleware',
                 '/api/routes', '/api/routes/all', '/api/configs', '/api/health',
                 '/api/agents', '/api/backups', '/api/settings'):
        assert rule in rules, 'route %s disappeared' % rule


def test_no_duplicate_rules(app_module):
    """Two blueprints registering the same path silently shadow each other."""
    seen = {}
    for r in app_module.app.url_map.iter_rules():
        for method in (r.methods or set()) - {'HEAD', 'OPTIONS'}:
            key = (r.rule, method)
            assert key not in seen, (
                'duplicate route: %s %s registered by both %s and %s'
                % (method, r.rule, seen[key], r.endpoint))
            seen[key] = r.endpoint


def test_dashboard_override_url_scheme_is_validated(client):
    """A stored card override URL becomes an href on the dashboard, so anything
    but http(s) must never survive the save."""
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
