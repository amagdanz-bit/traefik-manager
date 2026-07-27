"""Tests for core.settings and core.agents_store.

Agent credentials are encrypted at rest, so the round trip is tested against the
file on disk rather than just the return value - a broken encrypt path would
otherwise look fine in memory while writing plaintext secrets to agents.yml.
"""
import os

from core import agents_store, env, settings


def test_app_aliases_point_at_core(app_module):
    assert app_module.load_settings is settings.load_settings
    assert app_module.save_settings is settings.save_settings
    assert app_module.load_agents is agents_store.load_agents
    assert app_module.OPTIONAL_TABS is settings.OPTIONAL_TABS


def test_settings_round_trip(app_module):
    s = settings.load_settings()
    original = list(s['domains'])
    try:
        settings.save_settings(
            domains=['a.example.com', 'b.example.com'],
            cert_resolver=s['cert_resolver'],
            traefik_api_url=s['traefik_api_url'],
            auth_enabled=s['auth_enabled'],
            password_hash=s['password_hash'],
            visible_tabs=s['visible_tabs'],
        )
        assert settings.load_settings()['domains'] == ['a.example.com', 'b.example.com']
    finally:
        settings.save_settings(
            domains=original, cert_resolver=s['cert_resolver'],
            traefik_api_url=s['traefik_api_url'], auth_enabled=s['auth_enabled'],
            password_hash=s['password_hash'], visible_tabs=s['visible_tabs'])


def test_optional_tabs_is_the_full_list():
    for tab in ('dashboard', 'routemap', 'docker', 'kubernetes', 'certs', 'logs', 'crowdsec'):
        assert tab in settings.OPTIONAL_TABS


def test_settings_defaults_are_present():
    s = settings.load_settings()
    for key in ('domains', 'cert_resolver', 'traefik_api_url', 'auth_enabled',
                'visible_tabs', 'disabled_routes', 'managed_middlewares'):
        assert key in s, 'settings lost the %r key' % key


def _restore_agents(previous):
    if previous:
        agents_store.save_agents_file(previous)
    elif os.path.exists(env.AGENTS_PATH):
        os.remove(env.AGENTS_PATH)


def test_agent_secrets_are_encrypted_on_disk():
    previous = agents_store.load_agents()
    try:
        agents_store.save_agents_file([{
            'id': 'test-agent', 'name': 'Test', 'url': 'http://agent:8090',
            'api_key': 'PLAINTEXT-KEY',
            'crowdsec_api_key': 'CS-KEY',
            'git_backup_token': 'GIT-TOKEN',
        }])
        raw = open(env.AGENTS_PATH).read()
        for secret in ('PLAINTEXT-KEY', 'CS-KEY', 'GIT-TOKEN'):
            assert secret not in raw, '%s was written to agents.yml in plaintext' % secret

        loaded = agents_store.load_agents()
        assert len(loaded) == 1
        assert loaded[0]['api_key'] == 'PLAINTEXT-KEY'
        assert loaded[0]['crowdsec_api_key'] == 'CS-KEY'
        assert loaded[0]['git_backup_token'] == 'GIT-TOKEN'
    finally:
        _restore_agents(previous)


def test_agent_defaults_and_url_normalisation():
    parsed = agents_store.parse_agent_dict({
        'id': 'x', 'name': 'N', 'url': 'http://agent:8090/',
    })
    assert parsed['url'] == 'http://agent:8090', 'trailing slash not stripped'
    assert parsed['traefik_api_url'] == 'http://traefik:8080'
    assert parsed['config_path'] == '/app/config'
    assert parsed['git_backup_branch'] == 'main'
    assert parsed['domains'] == []


def test_agents_without_required_fields_are_dropped():
    previous = agents_store.load_agents()
    try:
        agents_store.save_agents_file([
            {'id': 'ok', 'name': 'Good', 'url': 'http://a:1'},
        ])
        # write a malformed entry directly and make sure load skips it
        raw = open(env.AGENTS_PATH).read()
        open(env.AGENTS_PATH, 'w').write(raw + "  - id: broken\n    name: NoUrl\n")
        loaded = agents_store.load_agents()
        assert [a['id'] for a in loaded] == ['ok'], 'an agent missing a url was not skipped'
    finally:
        _restore_agents(previous)


def test_load_agents_on_missing_file_is_empty():
    previous = agents_store.load_agents()
    try:
        if os.path.exists(env.AGENTS_PATH):
            os.remove(env.AGENTS_PATH)
        assert agents_store.load_agents() == []
    finally:
        _restore_agents(previous)
