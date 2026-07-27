"""Read-only client for the Traefik API."""
import os

import requests

from core import config
from core import settings as settings_mod
from core.env import logger


def _traefik_verify():
    if os.environ.get('TRAEFIK_INSECURE_SKIP_VERIFY', '').lower() in ('true', '1', 'yes'):
        return False
    return True

def traefik_api_get(path):
    settings = settings_mod.load_settings()
    base_url = settings['traefik_api_url']
    if not config.safe_api_url(base_url):
        logger.error("traefik_api_url failed safety check")
        return None
    u = settings.get('traefik_api_user', '')
    p = settings.get('traefik_api_password', '')
    auth = (u, p) if u and p else None
    try:
        resp = requests.get(f"{base_url}{path}", timeout=3, auth=auth, verify=_traefik_verify())
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.debug(f"Traefik API unavailable: {e}")
    return None

def traefik_api_get_all(path):
    sep = '&' if '?' in path else '?'
    return traefik_api_get(f"{path}{sep}per_page=1000")

def _fetch_traefik_routers_and_services():
    all_routers  = {}
    all_services = {}
    for proto in ('http', 'tcp', 'udp'):
        all_routers[proto]  = traefik_api_get_all(f'/api/{proto}/routers')  or []
        all_services[proto] = traefik_api_get_all(f'/api/{proto}/services') or []
    return all_routers, all_services
