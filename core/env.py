import logging
import os

GITHUB_REPO = "chr0nzz/traefik-manager"
APP_VERSION = "1.9.0"

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("traefik-manager")


def proxy_fix_hops() -> int:
    try:
        return max(0, int(os.environ.get('PROXY_FIX_HOPS', '1')))
    except ValueError:
        return 1


PROXY_FIX_HOPS = proxy_fix_hops()

BACKUP_DIR         = os.environ.get('BACKUP_DIR',    '/app/backups')
SETTINGS_PATH      = os.environ.get('SETTINGS_PATH', '/app/config/manager.yml')
CONFIG_DIR         = os.path.dirname(os.path.abspath(SETTINGS_PATH))
GROUPS_CACHE_DIR   = os.path.join(CONFIG_DIR, 'cache')
GEOIP_DIR          = os.path.join(CONFIG_DIR, 'geoip')
GROUPS_CONFIG_FILE = os.path.join(CONFIG_DIR, 'dashboard.yml')
NOTIFICATIONS_PATH = os.path.join(CONFIG_DIR, 'notifications.yml')
AGENTS_PATH        = os.path.join(CONFIG_DIR, 'agents.yml')
TEMPLATES_PATH     = os.path.join(CONFIG_DIR, 'templates.yml')
OTP_KEY_PATH       = os.path.join(CONFIG_DIR, '.otp_key')
SECRET_KEY_PATH    = os.path.join(CONFIG_DIR, '.secret_key')

os.makedirs(GROUPS_CACHE_DIR, exist_ok=True)

_config_dir = os.environ.get('CONFIG_DIR', '').strip()
ACTIVE_CONFIG_DIR = _config_dir
if _config_dir:
    import glob as _glob
    _ymls  = _glob.glob(os.path.join(_config_dir, '**', '*.yml'),  recursive=True)
    _yamls = _glob.glob(os.path.join(_config_dir, '**', '*.yaml'), recursive=True)
    CONFIG_PATHS = sorted(_ymls + _yamls) or [os.path.join(_config_dir, 'dynamic.yml')]
else:
    _raw_paths = os.environ.get('CONFIG_PATHS', '').strip()
    if _raw_paths:
        CONFIG_PATHS = [p.strip() for p in _raw_paths.split(',') if p.strip()]
    else:
        CONFIG_PATHS = [os.environ.get('CONFIG_PATH', '/app/config/dynamic.yml')]

CONFIG_PATH  = CONFIG_PATHS[0]
MULTI_CONFIG = len(CONFIG_PATHS) > 1

ALLOWED_API_SCHEMES = ('http://', 'https://')


def allowed_file_prefixes() -> tuple:
    return tuple(sorted(set(
        ['/app/',
         os.path.abspath(BACKUP_DIR) + '/',
         os.path.dirname(os.path.abspath(SETTINGS_PATH)) + '/'] +
        [os.path.dirname(os.path.abspath(p)) + '/' for p in CONFIG_PATHS]
    )))


ALLOWED_FILE_PREFIXES = allowed_file_prefixes()


def register_config_path(path: str):
    """Add a newly created config file to the active set.

    CONFIG_PATHS, CONFIG_PATH and MULTI_CONFIG are rebound here at runtime, so
    every consumer must read them as `env.CONFIG_PATHS` rather than importing
    the names directly - a `from core.env import CONFIG_PATHS` binds a snapshot
    and would silently stop seeing files created after startup.
    """
    global CONFIG_PATHS, CONFIG_PATH, MULTI_CONFIG, ALLOWED_FILE_PREFIXES
    if path and path not in CONFIG_PATHS:
        CONFIG_PATHS = sorted(CONFIG_PATHS + [path])
        CONFIG_PATH  = CONFIG_PATHS[0]
        MULTI_CONFIG = len(CONFIG_PATHS) > 1
        ALLOWED_FILE_PREFIXES = allowed_file_prefixes()
