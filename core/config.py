import os
import re
import shutil
import threading
from io import StringIO

from ruamel.yaml import YAML

from core import env
from core.env import logger


class ThreadLocalYAML:
    def __init__(self, typ=None):
        self._tl = threading.local()
        self._typ = typ

    def _y(self):
        y = getattr(self._tl, 'y', None)
        if y is None:
            if self._typ:
                y = YAML(typ=self._typ)
            else:
                y = YAML()
                y.preserve_quotes = True
                y.indent(mapping=2, sequence=4, offset=2)
                y.width = 4096
            self._tl.y = y
        return y

    def load(self, stream):
        return self._y().load(stream)

    def dump(self, data, stream):
        return self._y().dump(data, stream)


yaml = ThreadLocalYAML()
yaml_safe = ThreadLocalYAML(typ='safe')


def safe_file_path(path: str) -> str:
    if not path:
        return ''
    resolved = os.path.realpath(path)
    if any(resolved.startswith(p) for p in env.ALLOWED_FILE_PREFIXES):
        return resolved
    logger.warning(f"Blocked unsafe file path: {path!r}")
    return ''


def readable_config_path(path: str) -> str:
    """Realpath if within the allowed prefixes or a directory of an env-configured
    Traefik file. Blocks reading arbitrary files via web-set path settings."""
    if not path:
        return ''
    resolved = os.path.realpath(path)
    allowed  = list(env.ALLOWED_FILE_PREFIXES)
    for _ev in ('STATIC_CONFIG_PATH', 'ACCESS_LOG_PATH', 'ACME_JSON_PATH', 'PLUGINS_DIR'):
        _v = os.environ.get(_ev, '').strip()
        if _v:
            allowed.append(os.path.dirname(os.path.realpath(_v)) + os.sep)
    if any(resolved.startswith(p) for p in allowed):
        return resolved
    logger.warning(f"Blocked read of unsafe path: {path!r}")
    return ''


def is_safe_path(path: str) -> bool:
    """Return True if path is inside ACTIVE_CONFIG_DIR (prevents path traversal)."""
    if not env.ACTIVE_CONFIG_DIR:
        return False
    try:
        return os.path.realpath(path).startswith(os.path.realpath(env.ACTIVE_CONFIG_DIR) + os.sep)
    except Exception:
        return False


def resolve_config_path(s: str) -> str:
    """Validate a config file given a basename or full path against CONFIG_PATHS.
    Returns the canonical path if valid, '' otherwise.
    If ACTIVE_CONFIG_DIR is set and s is a plain filename, allows new files in CONFIG_DIR."""
    if not s:
        return env.CONFIG_PATH
    s = s.strip()
    for p in env.CONFIG_PATHS:
        if s == p or s == os.path.basename(p):
            return p
    if env.ACTIVE_CONFIG_DIR and '/' not in s and '\\' not in s:
        if not s.endswith(('.yml', '.yaml')):
            s = s + '.yml'
        candidate = os.path.join(env.ACTIVE_CONFIG_DIR, s)
        if is_safe_path(candidate):
            return candidate
    logger.warning(f"Config file not in CONFIG_PATHS: {s!r}")
    return ''


def safe_api_url(url: str) -> str:
    url = url.strip()
    if any(url.startswith(s) for s in env.ALLOWED_API_SCHEMES):
        return url
    logger.warning(f"Blocked unsafe API URL: {url!r}")
    return ''


def sanitize_go_templates(raw):
    mapping = {}
    counter = [0]

    def _replace(m):
        key = f'__TM_TEMPLATE_{counter[0]}__'
        mapping[key] = m.group(0)
        counter[0] += 1
        return key
    return re.sub(r'\{\{[^}]*\}\}', _replace, raw), mapping


def restore_go_templates(obj, mapping):
    if not mapping:
        return obj
    if isinstance(obj, str):
        for ph, orig in mapping.items():
            obj = obj.replace(ph, orig)
        return obj
    if isinstance(obj, dict):
        return {k: restore_go_templates(v, mapping) for k, v in obj.items()}
    if isinstance(obj, list):
        return [restore_go_templates(item, mapping) for item in obj]
    return obj


def load_config(path=None):
    if path is None:
        path = env.CONFIG_PATH
    if not os.path.exists(path):
        return {}
    with open(path, 'r') as f:
        raw = f.read()
    sanitized, _ = sanitize_go_templates(raw)
    data = yaml.load(sanitized)
    return data if data and isinstance(data, dict) else {}


def strip_empty_sections(config: dict) -> dict:
    """Remove empty routers/services/middlewares dicts to avoid Traefik 'standalone element' errors."""
    for proto in ('http', 'tcp', 'udp'):
        if proto in config:
            for section in ('routers', 'services', 'middlewares'):
                if section in config[proto] and not config[proto][section]:
                    del config[proto][section]
            if not config[proto]:
                del config[proto]
    return config


def save_config(data, path=None):
    if path is None:
        path = env.CONFIG_PATH
    template_map = {}
    if os.path.exists(path):
        with open(path, 'r') as f:
            _, template_map = sanitize_go_templates(f.read())
    stream = StringIO()
    yaml.dump(data, stream)
    content = stream.getvalue()
    for placeholder, original in template_map.items():
        content = content.replace(placeholder, original)
    tmp = f"{path}.tmp.{os.getpid()}.{threading.get_ident()}"
    try:
        with open(tmp, 'w') as f:
            f.write(content)
        shutil.copyfile(tmp, path)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    logger.info(f"Configuration saved: {path}")


def svc_key(name):
    if not isinstance(name, str):
        return ''
    return name.split('@')[0] if '@' in name else name


def as_dict(val):
    return val if isinstance(val, dict) else {}
