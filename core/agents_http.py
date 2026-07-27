"""HTTP client for remote Traefik Manager Agents."""
from io import StringIO

import requests

from core import config
from core import settings as settings_mod


def _agent_by_id(agent_id: str):
    for a in settings_mod.load_settings().get('agents', []):
        if a.get('id') == agent_id:
            return a
    return None

def _agent_request(agent: dict, method: str, path: str, **kwargs):
    url = agent['url'].rstrip('/') + '/' + path.lstrip('/')
    headers = kwargs.pop('headers', {})
    headers['X-Api-Key'] = agent.get('api_key', '')
    return requests.request(method, url, headers=headers, timeout=15, **kwargs)

def _agent_load_configs(agent: dict) -> dict:
    resp = _agent_request(agent, 'GET', '/api/configs')
    resp.raise_for_status()
    result = {}
    for f in (resp.json() or {}).get('files') or []:
        try:
            result[f['name']] = config.yaml_safe.load(f['content']) or {}
        except Exception:
            result[f['name']] = {}
    return result

def _agent_write_config(agent: dict, filename: str, config_dict: dict):
    stream = StringIO()
    config.yaml.dump(config.strip_empty_sections(config_dict) if config_dict else {}, stream)
    resp = _agent_request(agent, 'POST', '/api/configs', json={'name': filename, 'content': stream.getvalue()})
    resp.raise_for_status()
