"""Tests for core.backups, core.notifications, core.traefik and core.agents_http."""
import os

from core import agents_http, backups, env, notifications, traefik


def test_app_aliases_point_at_core(app_module):
    assert app_module.create_backup is backups.create_backup
    assert app_module.add_notification is notifications.add_notification
    assert app_module.traefik_api_get is traefik.traefik_api_get
    assert app_module._agent_request is agents_http._agent_request


def test_notification_state_is_shared_not_copied(app_module):
    """app.py must reference the same deque, not a snapshot of it."""
    assert app_module._notifications is notifications._notifications
    assert app_module._notif_lock is notifications._notif_lock


def test_add_notification_records_an_entry(app_module):
    before = len(notifications._notifications)
    notifications.add_notification('info', 'unit-test-entry')
    entries = list(notifications._notifications)
    assert len(entries) == before + 1
    assert entries[-1]['msg'] == 'unit-test-entry'
    assert entries[-1]['type'] == 'info'
    assert entries[-1]['ts']


def test_backup_creates_a_timestamped_copy(config_path):
    config_path.write_text('http:\n  routers:\n    marker: {}\n')
    dest = backups.create_backup(str(config_path))
    assert dest, 'create_backup returned nothing'
    assert os.path.exists(dest)
    assert 'marker' in open(dest).read()
    assert dest.endswith('.bak')


def test_backup_of_missing_file_is_harmless():
    assert not backups.create_backup('/nonexistent/none.yml')


def test_traefik_api_get_returns_none_when_unreachable():
    """The test env points at an unroutable host; callers rely on None, not an exception."""
    assert traefik.traefik_api_get('/api/http/routers') is None


def test_traefik_verify_follows_the_env_flag():
    prev = os.environ.get('TRAEFIK_INSECURE_SKIP_VERIFY')
    try:
        os.environ['TRAEFIK_INSECURE_SKIP_VERIFY'] = 'true'
        assert traefik._traefik_verify() is False
        os.environ['TRAEFIK_INSECURE_SKIP_VERIFY'] = 'false'
        assert traefik._traefik_verify() is True
    finally:
        if prev is None:
            os.environ.pop('TRAEFIK_INSECURE_SKIP_VERIFY', None)
        else:
            os.environ['TRAEFIK_INSECURE_SKIP_VERIFY'] = prev


def test_agent_by_id_returns_none_for_unknown():
    assert agents_http._agent_by_id('does-not-exist') is None


def test_notifications_survive_a_reload(app_module):
    notifications.add_notification('info', 'persisted-entry')
    notifications._save_notifications_bg()
    assert os.path.exists(env.NOTIFICATIONS_PATH)
    notifications._notifications.clear()
    notifications._load_notifications()
    assert any(n['msg'] == 'persisted-entry' for n in notifications._notifications), \
        'notifications did not round-trip through notifications.yml'
