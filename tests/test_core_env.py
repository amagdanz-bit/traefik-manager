import os

from core import env


def test_registering_a_new_config_path_is_visible_through_the_module():
    before = list(env.CONFIG_PATHS)
    new_path = os.path.join(os.path.dirname(before[0]), 'zz-registered-test.yml')
    try:
        env.register_config_path(new_path)
        assert new_path in env.CONFIG_PATHS, 'register_config_path did not add the file'
        assert env.MULTI_CONFIG is True, 'MULTI_CONFIG did not flip once a second file existed'
        assert env.CONFIG_PATH == env.CONFIG_PATHS[0]
        assert new_path in env.ALLOWED_FILE_PREFIXES[0] or any(
            os.path.dirname(new_path) + '/' == p for p in env.ALLOWED_FILE_PREFIXES), \
            'the new file directory was not added to the allowed prefixes'
    finally:
        env.CONFIG_PATHS = before
        env.CONFIG_PATH = before[0]
        env.MULTI_CONFIG = len(before) > 1
        env.ALLOWED_FILE_PREFIXES = env.allowed_file_prefixes()


def test_app_sees_registered_paths_through_core_env(app_module, client):
    before = list(env.CONFIG_PATHS)
    new_path = os.path.join(os.path.dirname(before[0]), 'zz-visible-test.yml')
    open(new_path, 'w').write('http:\n  routers: {}\n  services: {}\n')
    try:
        app_module._register_config_path(new_path)
        listed = [f['path'] for f in client.get('/api/configs').get_json()['files']]
        assert new_path in listed, (
            'a newly registered config file is not visible to the app - app.py is '
            'probably holding a stale copy of CONFIG_PATHS instead of reading env.CONFIG_PATHS')
    finally:
        env.CONFIG_PATHS = before
        env.CONFIG_PATH = before[0]
        env.MULTI_CONFIG = len(before) > 1
        env.ALLOWED_FILE_PREFIXES = env.allowed_file_prefixes()
        if os.path.exists(new_path):
            os.remove(new_path)


def test_crypto_round_trips_through_core():
    from core import crypto
    token = crypto.encrypt_secret('hunter2')
    assert token and token != 'hunter2'
    assert crypto.decrypt_secret(token) == 'hunter2'
    assert crypto.encrypt_secret('') == ''
    assert crypto.decrypt_secret('') == ''
    assert crypto.decrypt_secret('not-a-valid-token') == ''


def test_app_crypto_aliases_point_at_core(app_module):
    from core import crypto
    assert app_module._encrypt_otp_secret is crypto.encrypt_secret
    assert app_module._decrypt_otp_secret is crypto.decrypt_secret


def test_host_log_and_file_paths_resolve(app_module, client, tmp_path):
    log = os.path.join(os.path.dirname(env.SETTINGS_PATH), 'access.log')
    open(log, 'w').write('{"ClientAddr":"1.2.3.4:1","RequestHost":"a.example.com"}\n')
    try:
        assert app_module._safe_file_path(env.SETTINGS_PATH), '_safe_file_path rejected a known-good path'
        assert app_module._readable_config_path(log), '_readable_config_path rejected a file in the config dir'

        os.environ['ACCESS_LOG_PATH'] = log
        r = client.get('/api/traefik/logs?lines=10')
        assert r.status_code == 200, r.data[:200]
        assert 'error' not in (r.get_json() or {}) or 'not found' in r.get_json().get('error', ''), r.get_json()
    finally:
        os.environ.pop('ACCESS_LOG_PATH', None)
        if os.path.exists(log):
            os.remove(log)
