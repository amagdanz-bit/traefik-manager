import json
import re

from conftest import post_json
from core import settings as settings_mod


def _reset(app_module):
    s = settings_mod.load_settings()
    settings_mod.save_settings(
        domains=s['domains'], cert_resolver=s['cert_resolver'],
        traefik_api_url=s['traefik_api_url'], auth_enabled=s['auth_enabled'],
        password_hash=s['password_hash'], visible_tabs=s['visible_tabs'],
        ui_prefs={})


def test_defaults_are_empty(client, app_module):
    _reset(app_module)
    assert client.get('/api/settings/ui').get_json()['ui_prefs'] == {}


def test_round_trip(client, app_module):
    _reset(app_module)
    post_json(client, '/api/settings/ui', {'ui_prefs': {
        'showDocsLink': False, 'svcViewMode': 'list'}})
    got = client.get('/api/settings/ui').get_json()['ui_prefs']
    assert got['showDocsLink'] is False
    assert got['svcViewMode'] == 'list'


def test_unknown_keys_are_dropped(client, app_module):
    _reset(app_module)
    r = post_json(client, '/api/settings/ui', {'ui_prefs': {
        'showDocsLink': True,
        'password_hash': 'pwned',
        'agents': [{'id': 'x'}],
        '../../etc/passwd': 'x',
    }})
    stored = r.get_json()['ui_prefs']
    assert stored == {'showDocsLink': True}, stored
    assert 'password_hash' not in settings_mod.load_settings()['ui_prefs']
    assert settings_mod.load_settings()['password_hash'] != 'pwned'


def test_invalid_view_mode_is_rejected(client, app_module):
    _reset(app_module)
    r = post_json(client, '/api/settings/ui', {'ui_prefs': {'mwViewMode': 'bogus'}})
    assert 'mwViewMode' not in r.get_json()['ui_prefs']
    r = post_json(client, '/api/settings/ui', {'ui_prefs': {'mwViewMode': 'list'}})
    assert r.get_json()['ui_prefs']['mwViewMode'] == 'list'


def test_partial_update_merges(client, app_module):
    _reset(app_module)
    post_json(client, '/api/settings/ui', {'ui_prefs': {'showDocsLink': False}})
    r = post_json(client, '/api/settings/ui', {'ui_prefs': {'showApiLink': True}})
    stored = r.get_json()['ui_prefs']
    assert stored['showDocsLink'] is False, 'an earlier preference was lost'
    assert stored['showApiLink'] is True


def test_prefs_are_injected_into_the_page(client, app_module):
    _reset(app_module)
    post_json(client, '/api/settings/ui', {'ui_prefs': {'showStatCards': False}})
    html = client.get('/').data.decode()
    m = re.search(r'window\.TM_UI_PREFS = (\{.*?\});', html)
    assert m, 'TM_UI_PREFS was not rendered into the page'
    assert json.loads(m.group(1))['showStatCards'] is False


def test_requires_authentication(anon_client):
    assert anon_client.get('/api/settings/ui').status_code != 200
    assert anon_client.post('/api/settings/ui', json={'ui_prefs': {}}).status_code != 200


def test_non_object_payload_is_rejected(client, app_module):
    _reset(app_module)
    r = client.post('/api/settings/ui',
                    data=json.dumps({'ui_prefs': 'not-an-object'}),
                    content_type='application/json',
                    headers={'X-CSRF-Token': 'testtoken'})
    assert r.status_code == 400


def test_sanitiser_accepts_every_documented_key():
    payload = {k: True for k in settings_mod.UI_PREF_BOOLS}
    payload.update({k: 'list' for k in settings_mod.UI_PREF_VIEWS})
    payload.update({k: 'dashboard' for k in settings_mod.UI_PREF_SCOPES})
    payload.update({k: 'modern' for k in settings_mod.UI_PREF_LAYOUTS})
    cleaned = settings_mod.sanitize_ui_prefs(payload)
    assert set(cleaned) == set(settings_mod.UI_PREF_KEYS)


def test_stat_bar_scope_round_trips_and_validates(client):
    r = client.post('/api/settings/ui', json={'ui_prefs': {'statBarScope': 'dashboard'}},
                    headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 200
    assert r.get_json()['ui_prefs']['statBarScope'] == 'dashboard'

    r = client.post('/api/settings/ui', json={'ui_prefs': {'statBarScope': 'bogus'}},
                    headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 200
    assert r.get_json()['ui_prefs'].get('statBarScope') == 'dashboard'


def test_layout_mode_round_trips_and_rejects_junk(client):
    r = client.post('/api/settings/ui', json={'ui_prefs': {'layoutMode': 'modern'}},
                    headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert r.status_code == 200
    assert client.get('/api/settings/ui').get_json()['ui_prefs']['layoutMode'] == 'modern'

    client.post('/api/settings/ui', json={'ui_prefs': {'layoutMode': 'yolo'}},
                headers={'X-CSRF-Token': 'testtoken', 'X-Requested-With': 'fetch'})
    assert client.get('/api/settings/ui').get_json()['ui_prefs']['layoutMode'] == 'modern'
