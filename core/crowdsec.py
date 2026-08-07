"""CrowdSec LAPI client: decisions, alerts and machine login."""
import os
from datetime import datetime, timedelta, timezone

import requests

from core import settings as settings_mod
from core.env import logger

_cs_jwt_cache = {'token': '', 'expiry': None}


def _cs_lapi_url() -> str:
    s = settings_mod.load_settings()
    return s.get('crowdsec_lapi_url', '').strip() or os.environ.get('CROWDSEC_LAPI_URL', '').strip()


def _cs_api_key() -> str:
    s = settings_mod.load_settings()
    return s.get('crowdsec_api_key', '').strip() or os.environ.get('CROWDSEC_API_KEY', '').strip()


def _cs_machine_id() -> str:
    s = settings_mod.load_settings()
    return s.get('crowdsec_machine_id', '').strip() or os.environ.get('CROWDSEC_MACHINE_ID', '').strip()


def _cs_machine_password() -> str:
    s = settings_mod.load_settings()
    return s.get('crowdsec_machine_password', '').strip() or os.environ.get('CROWDSEC_MACHINE_PASSWORD', '').strip()


def _cs_has_machine() -> bool:
    return bool(_cs_machine_id() and _cs_machine_password())


class CrowdSecUnavailable(Exception):
    """The LAPI could not be reached or refused the read. Never the same as an empty result."""


def _cs_request_strict(method: str, path: str, lapi: str = None, key: str = None, **kwargs):
    if lapi is None:
        lapi = _cs_lapi_url()
    if key is None:
        key = _cs_api_key()
    lapi = (lapi or '').rstrip('/')
    if not lapi or not key:
        raise CrowdSecUnavailable('CrowdSec LAPI URL or bouncer API key is not set')
    try:
        resp = requests.request(method, f"{lapi}{path}",
                                headers={'X-Api-Key': key, 'Accept': 'application/json'},
                                timeout=5, **kwargs)
        resp.raise_for_status()
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else '?'
        logger.warning(f"CrowdSec LAPI error {method} {path}: {e}")
        raise CrowdSecUnavailable(f'LAPI answered HTTP {status} on {path}') from e
    except Exception as e:
        logger.warning(f"CrowdSec LAPI error {method} {path}: {e}")
        raise CrowdSecUnavailable(f'CrowdSec LAPI unreachable: {e}') from e
    return resp.json() if resp.content else None


def _cs_request(method: str, path: str, lapi: str = None, key: str = None, **kwargs):
    try:
        return _cs_request_strict(method, path, lapi=lapi, key=key, **kwargs)
    except CrowdSecUnavailable:
        return None


def _cs_jwt(lapi: str = None) -> str:
    if lapi is None:
        lapi = _cs_lapi_url()
    lapi = lapi.rstrip('/')
    mid  = _cs_machine_id()
    pw   = _cs_machine_password()
    if not (lapi and mid and pw):
        return ''
    now = datetime.now(timezone.utc)
    if _cs_jwt_cache['token'] and _cs_jwt_cache['expiry'] and now < _cs_jwt_cache['expiry']:
        return _cs_jwt_cache['token']
    try:
        resp = requests.post(f"{lapi}/v1/watchers/login",
                             json={'machine_id': mid, 'password': pw, 'scenarios': []},
                             timeout=5)
        resp.raise_for_status()
        body  = resp.json() or {}
        token = body.get('token', '')
        if not token:
            return ''
        _cs_jwt_cache['token'] = token
        try:
            exp = datetime.fromisoformat(str(body.get('expire', '')).replace('Z', '+00:00'))
            _cs_jwt_cache['expiry'] = exp - timedelta(minutes=2)
        except Exception:
            _cs_jwt_cache['expiry'] = now + timedelta(minutes=58)
        return token
    except Exception as e:
        logger.warning(f"CrowdSec machine login failed: {e}")
        return ''


def _cs_machine_request(method: str, path: str, **kwargs):
    lapi  = _cs_lapi_url().rstrip('/')
    token = _cs_jwt(lapi)
    if not (lapi and token):
        return None
    try:
        resp = requests.request(method, f"{lapi}{path}",
                                headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'},
                                timeout=5, **kwargs)
        resp.raise_for_status()
        return resp.json() if resp.content else {}
    except Exception as e:
        logger.warning(f"CrowdSec machine request error {method} {path}: {e}")
        return None
