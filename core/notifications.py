"""In-app notification log and webhook delivery."""
import os
import threading
import time
from collections import deque

import requests
from ruamel.yaml import YAML as SafeYAML

from core import env
from core import settings as settings_mod
from core.env import logger

_notifications = deque(maxlen=200)
_notif_lock    = threading.Lock()


def _is_ntfy_url(url: str) -> bool:
    from urllib.parse import urlparse
    try:
        h = urlparse(url).hostname or ''
        return h == 'ntfy.sh' or h.startswith('ntfy.') or '/api/v1/publish' in url
    except Exception:
        return False

def _send_webhook(url: str, wtype: str, type_: str, msg: str, ts: str, username: str = '', password: str = ''):
    color_map = {'warning': 0xf0a500, 'error': 0xf85149, 'info': 0x58a6ff, 'success': 0x3fb950}
    color = color_map.get(type_, 0x58a6ff)
    tag_map = {'warning': 'warning', 'error': 'rotating_light', 'success': 'white_check_mark', 'info': 'information_source'}
    auth = (username, password) if username else None
    if wtype == 'discord':
        payload = {'embeds': [{'title': msg, 'color': color, 'footer': {'text': f'Traefik Manager - {ts}'}}]}
        requests.post(url, json=payload, timeout=5, auth=auth)
    elif wtype == 'slack':
        icon = {'warning': ':warning:', 'error': ':x:', 'success': ':white_check_mark:', 'info': ':information_source:'}.get(type_, ':bell:')
        requests.post(url, json={'text': f'{icon} *Traefik Manager* - {msg}'}, timeout=5, auth=auth)
    elif wtype == 'ntfy':
        headers = {
            'X-Title': 'Traefik Manager',
            'X-Priority': '4' if type_ in ('warning', 'error') else '3',
            'X-Tags': tag_map.get(type_, 'bell'),
        }
        requests.post(url, data=msg.encode('utf-8'), headers=headers, timeout=5, auth=auth)
    else:
        requests.post(url, json={'event': type_, 'message': msg, 'timestamp': ts}, timeout=5, auth=auth)

def _fire_webhook(type_: str, msg: str, ts: str):
    s   = settings_mod.load_settings()
    url = s.get('webhook_url', '').strip()
    if not url:
        return
    wtype    = s.get('webhook_type', 'discord')
    username = s.get('webhook_username', '')
    password = s.get('webhook_password', '')
    try:
        _send_webhook(url, wtype, type_, msg, ts, username, password)
    except Exception as e:
        logger.warning(f"Webhook delivery failed: {e}")

def _load_notifications():
    if os.path.exists(env.NOTIFICATIONS_PATH):
        try:
            _y = SafeYAML(typ='safe')
            with open(env.NOTIFICATIONS_PATH, 'r') as f:
                data = _y.load(f) or []
            with _notif_lock:
                _notifications.clear()
                for entry in data[-100:]:
                    _notifications.append(entry)
        except Exception:
            pass

def _save_notifications_bg():
    try:
        _y = SafeYAML(typ='safe')
        with _notif_lock:
            data = list(_notifications)
        with open(env.NOTIFICATIONS_PATH, 'w') as f:
            _y.dump(data, f)
    except Exception:
        logger.exception("Failed to save notifications")

def add_notification(type_, msg):
    entry = {'ts': time.strftime("%Y-%m-%d %H:%M:%S"), 'type': type_, 'msg': msg}
    with _notif_lock:
        _notifications.append(entry)
    _save_notifications_bg()
    threading.Thread(target=_fire_webhook, args=(type_, msg, entry['ts']), daemon=True).start()
