import os
import re
import time
import shutil
import secrets
import threading
import ipaddress
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from datetime import datetime, timezone, timedelta
import click
from flask import (Flask, render_template, request, redirect,
                   url_for, flash, jsonify, abort, session, send_file)
from werkzeug.middleware.proxy_fix import ProxyFix
from ruamel.yaml import YAML
from ruamel.yaml import YAML as SafeYAML
from ruamel.yaml.scalarstring import DoubleQuotedScalarString
from io import StringIO

from core import env
from core.env import GITHUB_REPO, APP_VERSION, logger, PROXY_FIX_HOPS
from core import crypto

from core import config as _cfg
yaml                   = _cfg.yaml
_yaml_safe             = _cfg.yaml_safe
_safe_file_path        = _cfg.safe_file_path
_readable_config_path  = _cfg.readable_config_path
_is_safe_path          = _cfg.is_safe_path
_resolve_config_path   = _cfg.resolve_config_path
_safe_api_url          = _cfg.safe_api_url
_sanitize_go_templates = _cfg.sanitize_go_templates
_restore_go_templates  = _cfg.restore_go_templates
load_config            = _cfg.load_config
_strip_empty_sections  = _cfg.strip_empty_sections
save_config            = _cfg.save_config
_svc_key               = _cfg.svc_key
_as_dict               = _cfg.as_dict
_load_config_display         = _cfg._load_config_display
_get_config_parse_errors     = _cfg._get_config_parse_errors
from core import agents_store as _ag
from core import settings as _settings
OPTIONAL_TABS     = _settings.OPTIONAL_TABS
load_settings     = _settings.load_settings
save_settings     = _settings.save_settings
_get_acme_json_path      = _settings._get_acme_json_path
_get_access_log_path     = _settings._get_access_log_path
_get_static_config_path  = _settings._get_static_config_path
_get_restart_method      = _settings._get_restart_method
load_agents       = _ag.load_agents
save_agents_file  = _ag.save_agents_file
_save_agents      = _ag.encrypt_agents
_parse_agent_dict = _ag.parse_agent_dict
from core import backups as _back
from core import notifications as _noti
from core import traefik as _trae
from core import agents_http as _agen
from core import git as _git
from core import auth as _auth
from core import routes_build as _rb
from core import crowdsec as _crowd
from core import certs as _certs
_parse_cert_expiry           = _certs._parse_cert_expiry
_certs_from_tls_configs      = _certs._certs_from_tls_configs
from core import self_route as _self_r
_self_route_path             = _self_r._self_route_path
_detect_self_route_domain    = _self_r._detect_self_route_domain
_detect_self_route_from_own_labels = _self_r._detect_self_route_from_own_labels
_find_existing_self_route    = _self_r._find_existing_self_route
_write_self_route            = _self_r._write_self_route
_delete_self_route           = _self_r._delete_self_route
SELF_ROUTE_FILENAME          = _self_r.SELF_ROUTE_FILENAME
_cs_lapi_url               = _crowd._cs_lapi_url
_cs_api_key                = _crowd._cs_api_key
_cs_machine_id             = _crowd._cs_machine_id
_cs_machine_password       = _crowd._cs_machine_password
_cs_has_machine            = _crowd._cs_has_machine
_cs_request                = _crowd._cs_request
_cs_jwt_cache              = _crowd._cs_jwt_cache
_cs_jwt                    = _crowd._cs_jwt
_cs_machine_request        = _crowd._cs_machine_request
from core import geoip as _geoip
_geoip_enabled             = _geoip._geoip_enabled
_geoip_db_path             = _geoip._geoip_db_path
_geoip_reader              = _geoip._geoip_reader
_geoip_lookup              = _geoip._geoip_lookup
_geoip_status              = _geoip._geoip_status
_geoip_download            = _geoip._geoip_download
_DBIP_URL                  = _geoip._DBIP_URL
_GEOIP_SENTINEL            = _geoip._GEOIP_SENTINEL
_geoip_cache               = _geoip._geoip_cache
_geoip_lock                = _geoip._geoip_lock
_geoip_state               = _geoip._geoip_state
_trusted_ip_key                = _rb._trusted_ip_key
_merge_trusted_ips             = _rb._merge_trusted_ips
_apply_managed_keys            = _rb._apply_managed_keys
_merge_router                  = _rb._merge_router
_merge_service                 = _rb._merge_service
_json_plain                    = _rb._json_plain
_headers_preset_defaults       = _rb._headers_preset_defaults
_build_permissions_policy      = _rb._build_permissions_policy
_build_headers_middleware      = _rb._build_headers_middleware
_parse_permissions_policy      = _rb._parse_permissions_policy
_decode_headers_middleware     = _rb._decode_headers_middleware
_to_list                       = _rb._to_list
_service_type                  = _rb._service_type
_build_apps                    = _rb._build_apps
_build_middlewares             = _rb._build_middlewares
_traefik_router_ep_map         = _rb._traefik_router_ep_map
_traefik_service_url_map       = _rb._traefik_service_url_map
_build_external_routes         = _rb._build_external_routes
_entrypoint_mw_map             = _rb._entrypoint_mw_map
_build_all_apps                = _rb._build_all_apps
HEADERS_PRESET_FEATURES        = _rb.HEADERS_PRESET_FEATURES
HEADERS_PRESET_HSTS_SECONDS    = _rb.HEADERS_PRESET_HSTS_SECONDS
HEADERS_PRESET_REFERRER_DEFAULT = _rb.HEADERS_PRESET_REFERRER_DEFAULT
HEADERS_PRESET_REFERRER_VALUES = _rb.HEADERS_PRESET_REFERRER_VALUES
HEADERS_PRESET_SELF_DEFAULT    = _rb.HEADERS_PRESET_SELF_DEFAULT
_HEADERS_PRESET_KEYS           = _rb._HEADERS_PRESET_KEYS
_PERM_TOKEN_TO_VALUE           = _rb._PERM_TOKEN_TO_VALUE
_PERM_VALUE_TO_TOKEN           = _rb._PERM_VALUE_TO_TOKEN
_auth_enabled          = _auth._auth_enabled
_oidc_active           = _auth._oidc_active
_auth_required         = _auth._auth_required
_get_csrf_token        = _auth._get_csrf_token
_check_csrf            = _auth._check_csrf
csrf_protect           = _auth.csrf_protect
_check_password        = _auth._check_password
_verify_api_key        = _auth._verify_api_key
_is_authenticated      = _auth._is_authenticated
_check_inactivity      = _auth._check_inactivity
_check_api_key         = _auth._check_api_key
login_required         = _auth.login_required
_CsrfError = _auth._CsrfError
_git_repo_dir              = _git._git_repo_dir
_valid_git_url             = _git._valid_git_url
_safe_git_branch           = _git._safe_git_branch
_git_askpass_path          = _git._git_askpass_path
_git_run                   = _git._git_run
_git_ensure_repo_at        = _git._git_ensure_repo_at
_git_ensure_repo           = _git._git_ensure_repo
_git_lock                  = _git._git_lock
_git_push_configs          = _git._git_push_configs
_git_push_if_enabled       = _git._git_push_if_enabled
_git_agent_repo_dir        = _git._git_agent_repo_dir
_agent_git_branch          = _git._agent_git_branch
_git_push_agent_configs    = _git._git_push_agent_configs
_git_push_agent_if_enabled = _git._git_push_agent_if_enabled
_git_show_first            = _git._git_show_first
_GIT_ALLOWED_SCHEMES = _git._GIT_ALLOWED_SCHEMES
_GIT_PROTO_HARDENING = _git._GIT_PROTO_HARDENING
ensure_backup_dir            = _back.ensure_backup_dir
_backup_keep_count           = _back._backup_keep_count
_prune_backups               = _back._prune_backups
create_backup                = _back.create_backup
_is_ntfy_url                 = _noti._is_ntfy_url
_send_webhook                = _noti._send_webhook
_fire_webhook                = _noti._fire_webhook
_load_notifications          = _noti._load_notifications
_save_notifications_bg       = _noti._save_notifications_bg
add_notification             = _noti.add_notification
_traefik_verify              = _trae._traefik_verify
traefik_api_get              = _trae.traefik_api_get
traefik_api_get_all          = _trae.traefik_api_get_all
_fetch_traefik_routers_and_services = _trae._fetch_traefik_routers_and_services
_agent_by_id                 = _agen._agent_by_id
_agent_request               = _agen._agent_request
_agent_load_configs          = _agen._agent_load_configs
_agent_write_config          = _agen._agent_write_config
_notifications = _noti._notifications
_notif_lock    = _noti._notif_lock

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=PROXY_FIX_HOPS, x_proto=1, x_host=1)

_CONFIG_DIR      = os.path.dirname(os.environ.get('SETTINGS_PATH', '/app/config/manager.yml'))
_SECRET_KEY_PATH = os.path.join(_CONFIG_DIR, '.secret_key')

def _load_or_create_secret_key() -> bytes:
    env_key = os.environ.get('SECRET_KEY', '').strip()
    if env_key:
        if len(env_key) < 32:
            raise SystemExit("SECRET_KEY must be at least 32 characters. Generate one with: python3 -c \"import secrets; print(secrets.token_hex(32))\"")
        return env_key.encode()
    if os.path.exists(_SECRET_KEY_PATH):
        key = open(_SECRET_KEY_PATH, 'rb').read().strip()
        if len(key) >= 32:
            return key
    key = secrets.token_hex(32).encode()
    os.makedirs(os.path.dirname(_SECRET_KEY_PATH), exist_ok=True)
    with open(_SECRET_KEY_PATH, 'wb') as f:
        f.write(key)
    try:
        os.chmod(_SECRET_KEY_PATH, 0o600)
    except OSError:
        pass
    return key

app.secret_key = _load_or_create_secret_key()

_OTP_KEY_PATH        = env.OTP_KEY_PATH
_get_otp_fernet      = crypto.get_otp_fernet
_encrypt_otp_secret  = crypto.encrypt_secret
_decrypt_otp_secret  = crypto.decrypt_secret









def load_templates() -> list:
    if not os.path.exists(TEMPLATES_PATH):
        return []
    try:
        with open(TEMPLATES_PATH, 'r') as f:
            raw = _yaml_safe.load(f) or {}
        return [
            {'id': str(t['id']), 'name': str(t.get('name', ''))[:100], 'yaml': str(t.get('yaml', ''))}
            for t in (raw.get('templates', []) or [])
            if isinstance(t, dict) and t.get('id') and t.get('name')
        ]
    except Exception as e:
        logger.warning(f"Could not load templates.yml: {e}")
        return []


def save_templates_file(templates: list):
    import json as _json
    os.makedirs(os.path.dirname(TEMPLATES_PATH), exist_ok=True)
    tmp = f"{TEMPLATES_PATH}.tmp.{os.getpid()}.{threading.get_ident()}"
    safe = [{'id': t['id'], 'name': t['name'], 'yaml': t['yaml']} for t in templates]
    try:
        with open(tmp, 'w') as f:
            yaml.dump({'templates': _json.loads(_json.dumps(safe))}, f)
        os.replace(tmp, TEMPLATES_PATH)
    finally:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_HTTPONLY']    = True
app.config['SESSION_COOKIE_SAMESITE']    = 'Lax'


app.config['SESSION_COOKIE_SECURE']      = os.environ.get('COOKIE_SECURE', 'false').lower() == 'true'


INACTIVITY_TIMEOUT = _auth.INACTIVITY_TIMEOUT

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")





BACKUP_DIR         = env.BACKUP_DIR
SETTINGS_PATH      = env.SETTINGS_PATH
_CONFIG_DIR        = env.CONFIG_DIR
GROUPS_CACHE_DIR   = env.GROUPS_CACHE_DIR
GEOIP_DIR          = env.GEOIP_DIR
GROUPS_CONFIG_FILE = env.GROUPS_CONFIG_FILE
NOTIFICATIONS_PATH = env.NOTIFICATIONS_PATH
AGENTS_PATH        = env.AGENTS_PATH
TEMPLATES_PATH     = env.TEMPLATES_PATH








ACTIVE_CONFIG_DIR = env.ACTIVE_CONFIG_DIR
_ALLOWED_API_SCHEMES = env.ALLOWED_API_SCHEMES



def _ssrf_ok(url: str) -> bool:
    """False if the URL host resolves to a link-local (cloud metadata 169.254.x),
    multicast, reserved, or unspecified address. Private and loopback are allowed -
    a self-hosted tool legitimately reaches internal services (Traefik, ntfy, OIDC)."""
    try:
        from urllib.parse import urlparse
        import socket, ipaddress
        host = urlparse(url).hostname
        if not host:
            return False
        for res in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(res[4][0])
            if ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
                return False
        return True
    except Exception:
        return False



def _register_config_path(path: str):
    """Add a newly created config file to the active set (see core.env)."""
    env.register_config_path(path)















def _geoip_maybe_autoupdate():
    try:
        if not _geoip_enabled():
            return
        path = _geoip_db_path()
        stale = True
        if os.path.exists(path):
            try:
                stale = (time.time() - os.path.getmtime(path)) > 35 * 86400
            except OSError:
                stale = True
        if stale:
            _geoip_download()
    except Exception:
        logger.exception("GeoIP auto-update failed")

def _get_traefik_container() -> str:
    return os.environ.get('TRAEFIK_CONTAINER', 'traefik')

def _get_signal_file_path() -> str:
    return os.environ.get('SIGNAL_FILE_PATH', '/signals/restart.sig')








def _best_entrypoint() -> str:
    eps = traefik_api_get('/api/entrypoints') or []
    for ep in eps:
        addr = ep.get('address', '')
        if ':443' in addr or '/443' in addr:
            return ep.get('name', 'websecure')
    if eps:
        return eps[0].get('name', 'websecure')
    return 'websecure'








def _detect_setup_self_route() -> tuple[str, str]:
    settings = load_settings()
    saved = settings.get('self_route', {})
    if saved.get('domain'):
        return saved['domain'], saved.get('service_url', 'http://traefik-manager:5000')
    domain = _detect_self_route_domain()
    if domain:
        return domain, 'http://traefik-manager:5000'
    return _detect_self_route_from_own_labels()





def _hash_password(plaintext: str) -> str:
    import bcrypt
    return bcrypt.hashpw(plaintext.encode(), bcrypt.gensalt(rounds=12)).decode()


def _ensure_password():
    if os.environ.get('ADMIN_PASSWORD', '').strip():
        return
    settings = load_settings()
    if settings.get('password_hash', ''):
        return
    password = secrets.token_urlsafe(16)
    logger.warning("=" * 60)
    logger.warning("  TRAEFIK MANAGER - AUTO-GENERATED PASSWORD")
    logger.warning(f"  Password: {password}")
    logger.warning("  Log in with this password, complete setup, then")
    logger.warning("  you will be prompted to set a permanent password.")
    logger.warning("=" * 60)
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=_hash_password(password),
        visible_tabs=settings['visible_tabs'],
        must_change_password=True,
        setup_complete=False,
    )


def _read_traefik_labels():
    try:
        import docker as _docker
        client = _docker.from_env()
        container_name = os.environ.get('TRAEFIK_CONTAINER', 'traefik')
        for c in client.containers.list():
            labels = c.labels or {}
            if labels.get('traefik-manager.role') == 'traefik' or c.name == container_name:
                if not os.environ.get('RESTART_METHOD') and labels.get('traefik-manager.restart-method'):
                    os.environ['RESTART_METHOD'] = labels['traefik-manager.restart-method']
                if not os.environ.get('STATIC_CONFIG_PATH') and labels.get('traefik-manager.static-config'):
                    os.environ['STATIC_CONFIG_PATH'] = labels['traefik-manager.static-config']
                if not os.environ.get('TRAEFIK_CONTAINER'):
                    os.environ['TRAEFIK_CONTAINER'] = c.name
                logger.info(f"Static config: read labels from Traefik container {c.name!r}")
                break
    except Exception:
        pass

_read_traefik_labels()

_s = load_settings()
_static_path  = _get_static_config_path()
_restart_meth = _get_restart_method()
_oidc_on      = bool(_s.get('oidc_issuer'))
logger.info("===========================================")
logger.info(f"Traefik Manager v{APP_VERSION}")
if env.MULTI_CONFIG:
    for _cp in env.CONFIG_PATHS:
        logger.info(f"Config File:    {_cp}")
elif ACTIVE_CONFIG_DIR:
    logger.info(f"Config Dir:     {ACTIVE_CONFIG_DIR}")
else:
    logger.info(f"Config Path:    {env.CONFIG_PATH}")
logger.info(f"Settings Path:  {SETTINGS_PATH}")
logger.info(f"Backup Dir:     {BACKUP_DIR}")
logger.info(f"Traefik API:    {_s['traefik_api_url']}")
logger.info(f"Restart Method: {_restart_meth}")
logger.info(f"Trusted Hops:   {PROXY_FIX_HOPS}")
logger.info(f"Static Config:  {_static_path if _static_path else 'not configured'}")
logger.info(f"Domains:        {_s['domains']}")
logger.info(f"Cert Resolver:  {_s['cert_resolver'] or 'not set'}")
logger.info(f"Auth Enabled:   {_auth_enabled()}")
if _s.get('oidc_enabled'):
    logger.info(f"OIDC:           enabled ({_s.get('oidc_issuer', '')})")
if not _auth_enabled() and not _s.get('oidc_enabled'):
    logger.warning("SECURITY: no authentication is active - the web UI is publicly accessible. Enable a password or OIDC.")
if _s.get('oidc_enabled') and not _s.get('oidc_allowed_emails', '').strip() and not _s.get('oidc_allowed_groups', '').strip() and not _s.get('oidc_allow_any_authenticated'):
    logger.warning("SECURITY: OIDC is enabled with no allowed emails/groups - logins are denied until you set an allowlist or enable 'Allow any authenticated account'.")
logger.info("===========================================")

_ensure_password()


@app.context_processor
def _inject_theme():
    try:
        return {'default_theme': load_settings().get('default_theme', 'dark')}
    except Exception:
        return {'default_theme': 'dark'}




@app.errorhandler(_CsrfError)
def _handle_csrf_error(e):
    return jsonify({'ok': False, 'message': 'Session expired - please refresh the page.'}), 403


@app.context_processor
def inject_csrf():
    return {'csrf_token': _get_csrf_token()}


@app.context_processor
def inject_asset_version():
    return {'asset_version': APP_VERSION}



def _hash_api_key(key: str) -> str:
    import hashlib
    return 'sha256:' + hashlib.sha256(key.encode()).hexdigest()

def _safe_next(next_url: str) -> str:
    nu = (next_url or '').strip()
    if nu.startswith('/') and not nu.startswith('//') and not nu.startswith('/\\'):
        return nu
    return url_for('index')







def _has_password_set() -> bool:

    if os.environ.get('ADMIN_PASSWORD', '').strip():
        return True
    return bool(load_settings().get('password_hash', ''))

def _get_effective_hash() -> str:
    admin_pw = os.environ.get('ADMIN_PASSWORD', '').strip()
    if admin_pw:

        return _hash_password(admin_pw)
    return load_settings().get('password_hash', '')


_load_notifications()

threading.Thread(target=_geoip_maybe_autoupdate, daemon=True).start()

_SILENT_PREFIXES = (
    '/static/',
    '/api/notifications',
    '/api/traefik/',
    '/api/routes',
    '/api/dashboard/',
    '/api/manager/version',
    '/api/configs',
    '/api/settings/tabs',
    '/api/ping',
)

@app.before_request
def log_request_info():
    path = request.path
    method = request.method
    if method == 'GET':
        if request.remote_addr == '127.0.0.1':
            return
        if any(path.startswith(p) for p in _SILENT_PREFIXES):
            logger.debug(f"{request.remote_addr} → {method} {path}")
            return
    logger.info(f"{request.remote_addr} → {method} {path}")


@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options']         = 'DENY'
    response.headers['Referrer-Policy']          = 'strict-origin-when-cross-origin'
    response.headers['X-XSS-Protection']         = '1; mode=block'
    response.headers['Permissions-Policy']       = 'camera=(), microphone=(), geolocation=()'
    if not request.path.startswith('/static/') and 'Cache-Control' not in response.headers:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        response.headers['Pragma']        = 'no-cache'
        response.headers['Expires']       = '0'
    if app.config.get('SESSION_COOKIE_SECURE'):
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response


@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute", methods=["POST"])
def login():

    if not _auth_required():
        return redirect(url_for('index'))

    if session.get('authenticated'):
        return redirect(url_for('index'))

    settings = load_settings()
    local_auth = _auth_enabled()
    temp_password_hint = (
        settings.get('must_change_password', False)
        and not os.environ.get('ADMIN_PASSWORD', '').strip()
    )

    error = None
    if request.method == 'POST':
        _check_csrf()
        if not local_auth:
            error = 'Local password login is disabled. Sign in with your identity provider.'
            return render_template('login.html', error=error, next=request.args.get('next', ''),
                                   csrf_token=_get_csrf_token(), temp_password_hint=False,
                                   local_auth_enabled=False,
                                   oidc_enabled=settings.get('oidc_enabled', False),
                                   oidc_display_name=settings.get('oidc_display_name', 'OIDC'))
        password = request.form.get('password', '')
        pw_hash  = settings.get('password_hash', '')
        admin_pw = os.environ.get('ADMIN_PASSWORD', '').strip()

        if admin_pw:
            ok = secrets.compare_digest(password, admin_pw)
        else:
            ok = bool(pw_hash) and _check_password(password, pw_hash)

        if ok:
            remember = request.form.get('remember') == 'on'

            if settings.get('otp_enabled') and settings.get('otp_secret') and not admin_pw:
                session.clear()
                session['otp_pending']  = True
                session['otp_remember'] = bool(remember)
                session['otp_next']     = request.form.get('next') or ''
                session['otp_must_change'] = settings.get('must_change_password', False)
                session['otp_setup_complete'] = settings.get('setup_complete', False)
                logger.info(f"OTP step required for login from {request.remote_addr}")
                return redirect(url_for('login_otp'))

            _vals = {'authenticated': True,
                     'last_active': time.time(),
                     'login_time': datetime.now(timezone.utc).isoformat()}
            session.clear()
            session.update(_vals)
            session.permanent = remember
            logger.info(f"Successful login from {request.remote_addr}")
            add_notification('info', f"Login from {request.remote_addr}")

            if settings.get('must_change_password', False) and not admin_pw:
                if not settings.get('setup_complete', False):
                    return redirect(url_for('setup'))
                else:
                    return redirect(url_for('force_change_password'))

            return redirect(_safe_next(request.form.get('next')))
        else:
            error = 'Incorrect password.'
            logger.warning(f"Failed login attempt from {request.remote_addr}")

    next_url = request.args.get('next', '')
    return render_template('login.html', error=error, next=next_url,
                           csrf_token=_get_csrf_token(),
                           temp_password_hint=temp_password_hint,
                           local_auth_enabled=local_auth,
                           oidc_enabled=settings.get('oidc_enabled', False),
                           oidc_display_name=settings.get('oidc_display_name', 'OIDC'))


@app.route('/setup', methods=['GET', 'POST'])
def setup():
    if not _auth_required():
        return redirect(url_for('index'))

    current = load_settings()

    if current.get('setup_complete', False):
        if current.get('must_change_password', False):
            return redirect(url_for('force_change_password'))
        return redirect(url_for('index'))

    if _has_password_set() and not session.get('authenticated'):
        return redirect(url_for('login'))

    temp_password_mode = current.get('must_change_password', False) and bool(current.get('password_hash', ''))

    defaults = {
        'domains':         current['domains'],
        'cert_resolver':   current['cert_resolver'],
        'traefik_api_url': current['traefik_api_url'],
    }

    error = None
    if request.method == 'POST':
        _check_csrf()

        domains_raw         = request.form.get('domains', '').strip()
        cert_resolver       = request.form.get('cert_resolver', '').strip()
        traefik_api_url     = request.form.get('traefik_api_url', '').strip()
        traefik_api_user    = request.form.get('traefik_api_user', '').strip()
        traefik_api_password = request.form.get('traefik_api_password', '')
        visible_tabs_raw    = request.form.get('visible_tabs', '{}')
        pw                  = request.form.get('password', '')
        confirm             = request.form.get('confirm', '')
        self_route_domain   = request.form.get('self_route_domain', '').strip()
        self_route_svc      = request.form.get('self_route_service', '').strip() or 'http://traefik-manager:5000'
        self_route_ep       = request.form.get('self_route_entry_point', '').strip() or _best_entrypoint()

        domains = [d.strip() for d in domains_raw.split(',') if d.strip()]

        if not domains:
            error = 'Enter at least one domain.'
        elif not traefik_api_url:
            error = 'Enter the Traefik API URL.'
        elif not _safe_api_url(traefik_api_url):
            error = 'Traefik API URL must start with http:// or https://'
        elif not temp_password_mode and len(pw) < 8:
            error = 'Password must be at least 8 characters.'
        elif not temp_password_mode and pw != confirm:
            error = 'Passwords do not match.'
        else:
            import json as _json
            try:
                vt_raw = _json.loads(visible_tabs_raw)
                visible_tabs = {t: bool(vt_raw.get(t, False)) for t in OPTIONAL_TABS}
            except Exception:
                visible_tabs = {t: False for t in OPTIONAL_TABS}

            pw_hash = current['password_hash'] if temp_password_mode else _hash_password(pw)
            resolver = cert_resolver if cert_resolver.lower() not in ('none', '') else ''
            sr = {'domain': '', 'service_url': ''}
            if self_route_domain:
                sr = {'domain': self_route_domain, 'service_url': self_route_svc, 'entry_point': self_route_ep}
                _write_self_route(self_route_domain, self_route_svc, resolver, entry_point=self_route_ep)
            save_settings(
                domains=domains,
                cert_resolver=resolver,
                traefik_api_url=traefik_api_url,
                traefik_api_user=traefik_api_user,
                traefik_api_password=traefik_api_password,
                auth_enabled=True,
                password_hash=pw_hash,
                visible_tabs=visible_tabs,
                must_change_password=current.get('must_change_password', False),
                setup_complete=True,
                self_route=sr,
            )
            logger.info(f"Setup wizard completed from {request.remote_addr}")

            if temp_password_mode:
                return redirect(url_for('force_change_password'))

            session.clear()
            session.permanent        = True
            session['authenticated'] = True
            session['last_active']   = time.time()
            session['login_time']    = datetime.now(timezone.utc).isoformat()
            return redirect(url_for('index'))

    detected_domain, detected_svc = _detect_setup_self_route()
    detected_entry_point = load_settings().get('self_route', {}).get('entry_point', '') or _best_entrypoint()
    return render_template('login.html', setup_mode=True, error=error,
                           defaults=defaults, csrf_token=_get_csrf_token(),
                           temp_password_mode=temp_password_mode,
                           detected_self_domain=detected_domain,
                           detected_self_svc=detected_svc,
                           detected_self_entry_point=detected_entry_point)


@app.route('/logout', methods=['POST'])
@csrf_protect
def logout():
    session.clear()
    logger.info(f"User logged out from {request.remote_addr}")
    return redirect(url_for('login'))


@app.route('/force-change-password', methods=['GET', 'POST'])
@login_required
def force_change_password():
    settings = load_settings()
    if not settings.get('must_change_password', False):
        return redirect(url_for('index'))

    error = None
    if request.method == 'POST':
        _check_csrf()
        new_pw  = request.form.get('new_password', '')
        confirm = request.form.get('confirm_password', '')
        if len(new_pw) < 8:
            error = 'Password must be at least 8 characters.'
        elif new_pw != confirm:
            error = 'Passwords do not match.'
        else:
            save_settings(
                domains=settings['domains'],
                cert_resolver=settings['cert_resolver'],
                traefik_api_url=settings['traefik_api_url'],
                auth_enabled=settings['auth_enabled'],
                password_hash=_hash_password(new_pw),
                visible_tabs=settings['visible_tabs'],
                must_change_password=False,
                setup_complete=True,
            )
            logger.info(f"Forced password change completed from {request.remote_addr}")
            return redirect(url_for('index'))

    return render_template('login.html', force_change_mode=True, error=error,
                           csrf_token=_get_csrf_token())


@app.cli.command('reset-password')
@click.option('--disable-otp', is_flag=True, default=False,
              help='Also disable two-factor authentication (use if TOTP app is lost).')
def reset_password_cli(disable_otp):

    password = secrets.token_urlsafe(16)
    settings = load_settings()
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings.get('auth_enabled', True),
        password_hash=_hash_password(password),
        visible_tabs=settings['visible_tabs'],
        must_change_password=True,
        setup_complete=settings.get('setup_complete', True),
        otp_secret='' if disable_otp else None,
        otp_enabled=False if disable_otp else None,
    )
    print("=" * 60)
    print("TRAEFIK MANAGER - PASSWORD RESET")
    print(f"New temporary password: {password}")
    if disable_otp:
        print("Two-factor authentication has been DISABLED.")
    print("You will be required to change it on next login.")
    print("=" * 60)


@app.route('/api/auth/change-password', methods=['POST'])
@limiter.limit("10 per minute")
@csrf_protect
@login_required
def api_change_password():

    data        = request.get_json()
    current_pw  = (data or {}).get('current_password', '')
    new_pw      = (data or {}).get('new_password', '')
    confirm_pw  = (data or {}).get('confirm_password', '')

    if len(new_pw) < 8:
        return jsonify({'error': 'New password must be at least 8 characters.'}), 400
    if new_pw != confirm_pw:
        return jsonify({'error': 'Passwords do not match.'}), 400

    settings   = load_settings()
    pw_hash    = settings.get('password_hash', '')
    admin_pw   = os.environ.get('ADMIN_PASSWORD', '').strip()

    if admin_pw:
        ok = secrets.compare_digest(current_pw, admin_pw)
    else:
        ok = bool(pw_hash) and _check_password(current_pw, pw_hash)

    if not ok:
        logger.warning(f"Failed password change attempt from {request.remote_addr}")
        return jsonify({'error': 'Current password is incorrect.'}), 403

    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=_hash_password(new_pw),
        visible_tabs=settings['visible_tabs'],
        must_change_password=False,
    )
    logger.info(f"Password changed successfully from {request.remote_addr}")
    return jsonify({'success': True})


@app.route('/api/auth/toggle', methods=['POST'])
@csrf_protect
@login_required
def api_auth_toggle():

    data    = request.get_json()
    enabled = bool((data or {}).get('auth_enabled', True))
    settings = load_settings()
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=enabled,
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
    )
    logger.info(f"auth_enabled set to {enabled} by {request.remote_addr}")
    reauth = _auth_required() and not session.get('authenticated')
    return jsonify({'success': True, 'auth_enabled': enabled, 'reauth_required': reauth})


@app.route('/login/otp', methods=['GET', 'POST'])
@limiter.limit("5 per minute", methods=["POST"])
def login_otp():
    if not session.get('otp_pending'):
        return redirect(url_for('login'))

    error = None
    if request.method == 'POST':
        _check_csrf()
        import pyotp
        code     = request.form.get('code', '').strip()
        settings = load_settings()
        secret   = settings.get('otp_secret', '')
        try:
            otp_valid = secret and pyotp.TOTP(secret).verify(code, valid_window=1)
        except Exception:
            logger.exception("OTP verify error - secret may be corrupt")
            otp_valid = False
        if otp_valid:
            remember       = session.get('otp_remember', True)
            must_change    = session.get('otp_must_change', False)
            setup_complete = session.get('otp_setup_complete', False)
            next_url       = session.get('otp_next', '') or url_for('index')
            _vals = {'authenticated': True,
                     'last_active': time.time(),
                     'login_time': datetime.now(timezone.utc).isoformat()}
            session.clear()
            session.update(_vals)
            session.permanent = remember
            logger.info(f"Successful OTP login from {request.remote_addr}")
            add_notification('info', f"Login from {request.remote_addr}")
            if must_change:
                if not setup_complete:
                    return redirect(url_for('setup'))
                return redirect(url_for('force_change_password'))
            return redirect(_safe_next(next_url))
        else:
            error = 'Invalid code. Please try again.'
            logger.warning(f"Failed OTP attempt from {request.remote_addr}")

    return render_template('login.html', otp_mode=True, error=error,
                           csrf_token=_get_csrf_token())


@app.route('/api/auth/otp/setup', methods=['POST'])
@csrf_protect
@login_required
def api_otp_setup():
    import pyotp
    secret = pyotp.random_base32()
    uri    = pyotp.TOTP(secret).provisioning_uri(
        name='Traefik Manager',
        issuer_name='traefik-manager'
    )
    session['otp_pending_secret'] = secret
    return jsonify({'secret': secret, 'uri': uri})


@app.route('/api/auth/otp/enable', methods=['POST'])
@csrf_protect
@login_required
def api_otp_enable():
    import pyotp
    code   = (request.get_json() or {}).get('code', '').strip()
    secret = session.pop('otp_pending_secret', '')
    if not secret or not pyotp.TOTP(secret).verify(code, valid_window=1):
        return jsonify({'error': 'Invalid code - please try again.'}), 400
    settings = load_settings()
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
        otp_secret=secret,
        otp_enabled=True,
    )
    logger.info(f"OTP enabled by {request.remote_addr}")
    return jsonify({'success': True})


@app.route('/api/auth/otp/disable', methods=['POST'])
@csrf_protect
@login_required
def api_otp_disable():
    settings = load_settings()
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
        otp_secret='',
        otp_enabled=False,
    )
    logger.info(f"OTP disabled by {request.remote_addr}")
    return jsonify({'success': True})


@app.route('/api/auth/otp/status')
@login_required
def api_otp_status():
    settings = load_settings()
    return jsonify({'otp_enabled': settings.get('otp_enabled', False)})


@app.route('/api/auth/apikey/generate', methods=['POST'])
@limiter.limit("5 per hour")
@csrf_protect
@login_required
def api_apikey_generate():
    data = request.get_json(silent=True) or {}
    device_name = str(data.get('device_name', '')).strip()[:50]
    if not device_name:
        return jsonify({'ok': False, 'error': 'device_name is required'}), 400
    settings = load_settings()
    api_keys = settings.get('api_keys', [])
    if len(api_keys) >= 10:
        return jsonify({'ok': False, 'error': 'Maximum of 10 API keys reached'}), 400
    key = secrets.token_urlsafe(32)
    preview = key[:8] + '...' + key[-4:]
    api_keys.append({
        'name':       device_name,
        'hash':       _hash_api_key(key),
        'preview':    preview,
        'created_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M'),
    })
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
        otp_secret=settings['otp_secret'],
        otp_enabled=settings['otp_enabled'],
        api_keys=api_keys,
    )
    logger.info(f"API key '{device_name}' generated by {request.remote_addr}")
    return jsonify({'ok': True, 'key': key})


@app.route('/api/auth/apikey/revoke', methods=['POST'])
@csrf_protect
@login_required
def api_apikey_revoke():
    data = request.get_json(silent=True) or {}
    preview = str(data.get('preview', '')).strip()
    if not preview:
        return jsonify({'ok': False, 'error': 'preview is required'}), 400
    settings = load_settings()
    api_keys = [k for k in settings.get('api_keys', []) if k.get('preview') != preview]
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
        otp_secret=settings['otp_secret'],
        otp_enabled=settings['otp_enabled'],
        api_keys=api_keys,
    )
    logger.info(f"API key revoked by {request.remote_addr}")
    return jsonify({'ok': True})


@app.route('/api/auth/apikey/status')
@login_required
def api_apikey_status():
    settings = load_settings()
    api_keys = settings.get('api_keys', [])
    return jsonify({
        'enabled': len(api_keys) > 0,
        'keys': [{'name': k['name'], 'preview': k['preview'], 'created_at': k.get('created_at', '')} for k in api_keys],
        'count': len(api_keys),
    })


if not os.environ.get('REQUESTS_CA_BUNDLE'):
    _SYSTEM_CA_BUNDLE = '/etc/ssl/certs/ca-certificates.crt'
    if os.path.exists(_SYSTEM_CA_BUNDLE):
        os.environ['REQUESTS_CA_BUNDLE'] = _SYSTEM_CA_BUNDLE





@app.route('/api/traefik/overview')
@login_required
def api_overview():
    return jsonify(traefik_api_get('/api/overview') or {})

@app.route('/api/traefik/routers')
@login_required
def api_routers():
    return jsonify({
        'http': traefik_api_get_all('/api/http/routers') or [],
        'tcp':  traefik_api_get_all('/api/tcp/routers')  or [],
        'udp':  traefik_api_get_all('/api/udp/routers')  or [],
    })

@app.route('/api/traefik/services')
@login_required
def api_services():
    return jsonify({
        'http': traefik_api_get_all('/api/http/services') or [],
        'tcp':  traefik_api_get_all('/api/tcp/services')  or [],
        'udp':  traefik_api_get_all('/api/udp/services')  or [],
    })

@app.route('/api/traefik/middlewares')
@login_required
def api_middlewares():
    http_mws = traefik_api_get_all('/api/http/middlewares')
    tcp_mws  = traefik_api_get_all('/api/tcp/middlewares')
    if http_mws is None and tcp_mws is None:
        return jsonify({'error': 'Traefik API unreachable'}), 502
    return jsonify({
        'http': http_mws or [],
        'tcp':  tcp_mws  or [],
    })

@app.route('/api/manager/router-names')
@login_required
def api_manager_router_names():
    config = load_config()
    names = set()
    for proto in ('http', 'tcp', 'udp'):
        names.update(config.get(proto, {}).get('routers', {}).keys())
    return jsonify(list(names))


@app.route('/api/traefik/entrypoints')
@login_required
def api_entrypoints():
    eps = traefik_api_get('/api/entrypoints')
    if eps is None:
        return jsonify({'error': 'Traefik API unreachable'}), 502
    return jsonify(eps)

@app.route('/api/traefik/version')
@login_required
def api_version():
    return jsonify(traefik_api_get('/api/version') or {})











@app.route('/api/crowdsec/decisions')
@login_required
def api_cs_decisions():
    lapi = _cs_lapi_url()
    key  = _cs_api_key()
    if not (lapi and key):
        return jsonify({'error': 'CrowdSec not configured'}), 503
    try:
        all_decisions = []
        page = 1
        MAX_CS_PAGES = 10
        while page <= MAX_CS_PAGES:
            chunk = _cs_request('GET', f'/v1/decisions?limit=500&page={page}', lapi=lapi, key=key)
            if not isinstance(chunk, list):
                break
            all_decisions.extend(chunk)
            if len(chunk) < 500:
                break
            page += 1
        now = datetime.now(timezone.utc)
        active = []
        for d in all_decisions:
            until = d.get('until')
            if until:
                try:
                    exp = datetime.fromisoformat(until.replace('Z', '+00:00'))
                    if exp < now:
                        continue
                except Exception:
                    pass
            active.append(d)
        return jsonify(active)
    except Exception as e:
        logger.exception("CrowdSec decisions error")
        return jsonify({'error': str(e)}), 500

@app.route('/api/crowdsec/alerts')
@login_required
def api_cs_alerts():
    lapi = _cs_lapi_url()
    if not (lapi and (_cs_api_key() or _cs_has_machine())):
        return jsonify({'error': 'CrowdSec not configured'}), 503
    try:
        if _cs_has_machine():
            token = _cs_jwt(lapi)
            if not token:
                return jsonify({'error': 'CrowdSec machine login failed - check CROWDSEC_MACHINE_ID / CROWDSEC_MACHINE_PASSWORD'}), 502
            headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
        else:
            headers = {'X-Api-Key': _cs_api_key(), 'Accept': 'application/json'}
        resp = requests.get(
            f"{lapi.rstrip('/')}/v1/alerts?limit=200",
            headers=headers,
            timeout=5,
        )
        if not resp.ok:
            try:
                msg = resp.json().get('message') or resp.json().get('error') or resp.text
            except Exception:
                msg = resp.text
            return jsonify({'error': f'LAPI {resp.status_code}: {msg}'}), resp.status_code
        alerts = resp.json() if resp.content else []
        if not isinstance(alerts, list):
            alerts = []
        filtered = [al for al in alerts
                    if not (al.get('decisions') and al['decisions'][0].get('origin') == 'lists')]
        return jsonify(filtered)
    except Exception as e:
        logger.exception("CrowdSec alerts error")
        return jsonify({'error': str(e)}), 500

@app.route('/api/crowdsec/decisions', methods=['POST'])
@csrf_protect
@login_required
def api_cs_add_decision():
    lapi = _cs_lapi_url()
    key  = _cs_api_key()
    if not (lapi and key):
        return jsonify({'error': 'CrowdSec not configured'}), 503
    data     = request.get_json() or {}
    ip       = data.get('value', '').strip()
    dtype    = data.get('type', 'ban').strip()
    duration = data.get('duration', '24h').strip()
    reason   = (data.get('reason', '') or '').strip() or 'manual ban from Traefik Manager'
    if not ip:
        return jsonify({'error': 'IP/Range is required'}), 400
    if dtype not in ('ban', 'captcha', 'bypass'):
        return jsonify({'error': 'Invalid type'}), 400
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    payload = [{
        'capacity': 0,
        'decisions': [{'duration': duration, 'origin': 'manual', 'scenario': reason,
                       'scope': 'Ip', 'type': dtype, 'value': ip, 'simulated': False}],
        'events': [], 'events_count': 1, 'labels': None, 'leakspeed': '0',
        'message': reason, 'scenario': reason, 'scenario_hash': '', 'scenario_version': '',
        'simulated': False,
        'source': {'ip': ip, 'scope': 'Ip', 'value': ip},
        'start_at': now, 'stop_at': now,
    }]
    if _cs_has_machine():
        result = _cs_machine_request('POST', '/v1/alerts', json=payload)
    else:
        result = _cs_request('POST', '/v1/alerts', lapi=lapi, key=key, json=payload)
    if result is None:
        return jsonify({'error': 'Failed to add decision - check LAPI permissions'}), 502
    return jsonify({'ok': True})

@app.route('/api/crowdsec/decisions/<int:decision_id>', methods=['DELETE'])
@csrf_protect
@login_required
def api_cs_unban(decision_id):
    if not (_cs_lapi_url() and (_cs_api_key() or _cs_has_machine())):
        return jsonify({'error': 'CrowdSec not configured'}), 503
    if _cs_has_machine():
        result = _cs_machine_request('DELETE', f'/v1/decisions/{decision_id}')
    else:
        result = _cs_request('DELETE', f'/v1/decisions/{decision_id}')
    if result is None:
        return jsonify({'error': 'Failed to delete decision'}), 500
    add_notification('success', f'Decision {decision_id} deleted (IP unbanned)')
    return jsonify({'ok': True})


@app.route('/api/ping')
@login_required
def api_route_ping():
    import time as _t
    from urllib.parse import urlparse
    url      = request.args.get('url', '').strip()
    fallback = request.args.get('fallback', '').strip()
    if not url or not url.startswith(('http://', 'https://')):
        return jsonify({'ok': False, 'error': 'Invalid URL'}), 400
    if not _ssrf_ok(url):
        return jsonify({'ok': False, 'error': 'Target address not allowed'}), 400
    host = urlparse(url).hostname or ''
    tm_host = request.host.split(':')[0].lower()
    if host.lower() == tm_host:
        return jsonify({'ok': True, 'latency_ms': 0, 'status_code': 200, 'self': True})
    settings = load_settings()
    self_domain = (settings.get('self_route') or {}).get('domain', '').strip().lower()
    if self_domain and host.lower() == self_domain:
        return jsonify({'ok': True, 'latency_ms': 0, 'status_code': 200, 'self': True})
    def _ping(target):
        t0   = _t.monotonic()
        resp = requests.head(target, timeout=5, allow_redirects=False, verify=False)
        ms   = round((_t.monotonic() - t0) * 1000)
        return ms, resp.status_code
    try:
        ms, code = _ping(url)
        return jsonify({'ok': True, 'latency_ms': ms, 'status_code': code})
    except Exception as primary_err:
        if fallback and fallback.startswith(('http://', 'https://')):
            try:
                ms, code = _ping(fallback)
                return jsonify({'ok': True, 'latency_ms': ms, 'status_code': code, 'via_target': True})
            except Exception:
                pass
        err = str(primary_err)[:80]
        return jsonify({'ok': False, 'error': 'Timeout' if 'timeout' in err.lower() else err, 'latency_ms': None})

def _apr1_hash(password: str, salt: str) -> str:
    import hashlib
    pw  = password.encode('latin-1')
    sl  = salt.encode('ascii')
    mgc = b'$apr1$'
    a   = hashlib.md5(pw + mgc + sl)
    b   = hashlib.md5(pw + sl + pw).digest()
    plen = len(pw)
    ndig, nrem = divmod(plen, 16)
    for n in ndig * [16] + [nrem]:
        a.update(b[:n])
    i = plen
    while i:
        a.update(b'\x00' if (i & 1) else pw[:1])
        i >>= 1
    a = a.digest()
    for i in range(1000):
        c = hashlib.md5()
        c.update(pw if (i & 1) else a)
        if i % 3: c.update(sl)
        if i % 7: c.update(pw)
        c.update(a if (i & 1) else pw)
        a = c.digest()
    t64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    def to64(v, n):
        r = ''
        for _ in range(n):
            r += t64[v & 0x3f]; v >>= 6
        return r
    enc  = to64((a[0]<<16)|(a[6]<<8)|a[12], 4)
    enc += to64((a[1]<<16)|(a[7]<<8)|a[13], 4)
    enc += to64((a[2]<<16)|(a[8]<<8)|a[14], 4)
    enc += to64((a[3]<<16)|(a[9]<<8)|a[15], 4)
    enc += to64((a[4]<<16)|(a[10]<<8)|a[5], 4)
    enc += to64(a[11], 2)
    return f'$apr1${salt}${enc}'



@app.route('/api/traefik/ping')
@login_required
def api_ping():
    import time as _t
    settings = load_settings()
    u = settings.get('traefik_api_user', '')
    p = settings.get('traefik_api_password', '')
    auth = (u, p) if u and p else None
    try:
        t0   = _t.monotonic()
        resp = requests.get(f"{settings['traefik_api_url']}/ping", timeout=3, auth=auth, verify=_traefik_verify())
        ms   = round((_t.monotonic() - t0) * 1000)
        if resp.status_code == 200:
            return jsonify({'ok': True, 'latency_ms': ms})
    except Exception as e:
        logger.debug(f"Ping failed: {e}")
    return jsonify({'ok': False, 'latency_ms': None}), 503

@app.route('/api/manager/version')
@login_required
def api_manager_version():
    return jsonify({
        "version": APP_VERSION,
        "repo": GITHUB_REPO,
        "static_config_configured": bool(_get_static_config_path()),
    })

@app.route('/api/health')
def api_health():
    return jsonify({"ok": True}), 200


@app.route('/api')
def api_docs():
    from flask import send_from_directory
    return send_from_directory('static', 'api.html')


@app.route('/openapi.yaml')
def openapi_yaml():
    import re as _re
    try:
        with open(os.path.join(app.static_folder, 'openapi.yaml'), 'r') as f:
            spec = f.read()
        spec = _re.sub(r'(?m)^(\s*version:\s*).*$', rf'\g<1>{APP_VERSION}', spec, count=1)
        return spec, 200, {'Content-Type': 'application/yaml'}
    except Exception:
        from flask import send_from_directory
        return send_from_directory('static', 'openapi.yaml')


def _restart_via_docker() -> bool:
    try:
        import docker as _docker
        client = _docker.from_env()
        container = client.containers.get(_get_traefik_container())
        container.restart()
        logger.info(f"Restarted Traefik container: {_get_traefik_container()!r}")
        return True
    except Exception as e:
        logger.error(f"Docker restart failed: {e}")
        return False

def _restart_via_signal_file() -> bool:
    try:
        sig_path = _get_signal_file_path()
        os.makedirs(os.path.dirname(sig_path), exist_ok=True)
        with open(sig_path, 'w') as f:
            f.write('')
        logger.info(f"Restart signal written: {sig_path}")
        return True
    except Exception as e:
        logger.error(f"Signal file write failed: {e}")
        return False

def trigger_traefik_restart() -> tuple:
    method = _get_restart_method()
    if method in ('proxy', 'socket'):
        ok = _restart_via_docker()
        return ok, ('' if ok else f'Docker restart failed - check DOCKER_HOST and TRAEFIK_CONTAINER ({_get_traefik_container()!r})')
    if method == 'poison-pill':
        ok = _restart_via_signal_file()
        return ok, ('' if ok else f'Signal file write failed - check SIGNAL_FILE_PATH ({_get_signal_file_path()!r})')
    return False, f'Unknown RESTART_METHOD: {method!r}'


@app.route('/api/static/available')
@login_required
def api_static_available():
    path = _get_static_config_path()
    return jsonify({'available': bool(path and os.path.exists(path))})

@app.route('/api/static/config')
@login_required
def api_static_config_get():
    path = _readable_config_path(_get_static_config_path())
    if not path or not os.path.exists(path):
        return jsonify({'error': 'Static config not found or STATIC_CONFIG_PATH not set'}), 404
    try:
        with open(path, 'r') as f:
            raw = f.read()
        _y = SafeYAML(typ='safe')
        parsed = _y.load(raw) or {}
        return jsonify({'raw': raw, 'parsed': parsed, 'path': path})
    except Exception as e:
        logger.exception("Failed to read static config")
        return jsonify({'error': str(e)}), 500

@app.route('/api/static/config', methods=['POST'])
@csrf_protect
@login_required
def api_static_config_save():
    path = _get_static_config_path()
    if not path:
        return jsonify({'error': 'STATIC_CONFIG_PATH not configured'}), 400
    safe_path = _safe_file_path(path)
    if not safe_path:
        return jsonify({'error': 'Static config path is outside allowed directories'}), 403
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or data.get('raw') or '').strip()
    if not content:
        return jsonify({'error': 'No content provided'}), 400
    try:
        _y = SafeYAML(typ='safe')
        _y.load(content)
    except Exception as e:
        return jsonify({'error': f'Invalid YAML: {e}'}), 400
    try:
        create_backup(safe_path)
        with open(safe_path, 'w') as f:
            f.write(content)
        logger.info(f"Static config saved by {request.remote_addr}: {safe_path}")
        add_notification('success', 'Static config saved')
        threading.Thread(target=lambda: _git_push_if_enabled('static config save'), daemon=True).start()
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception("Failed to write static config")
        return jsonify({'error': str(e)}), 500

@app.route('/api/static/restart', methods=['POST'])
@csrf_protect
@login_required
def api_static_restart():
    ok, err = trigger_traefik_restart()
    if ok:
        logger.info(f"Traefik restarted via static config by {request.remote_addr}")
        add_notification('warning', 'Traefik restarted')
        return jsonify({'ok': True})
    logger.error(f"Traefik restart failed for {request.remote_addr}: {err}")
    return jsonify({'ok': False, 'error': err}), 500

@app.route('/api/static/status')
@login_required
def api_static_status():
    data = traefik_api_get('/api/overview')
    return jsonify({'up': data is not None})

@app.route('/api/traefik/runtime')
@login_required
def api_traefik_runtime():
    method = _get_restart_method()
    container = _get_traefik_container()
    if method in ('proxy', 'socket'):
        return jsonify({'method': method, 'runtime': 'docker', 'container': container})
    if method == 'poison-pill':
        try:
            import docker as _docker
            client = _docker.from_env()
            client.containers.get(container)
            return jsonify({'method': method, 'runtime': 'docker', 'container': container})
        except Exception:
            return jsonify({'method': method, 'runtime': 'native', 'container': None})
    return jsonify({'method': method, 'runtime': 'unknown', 'container': None})

@app.route('/api/static/section', methods=['POST'])
@csrf_protect
@login_required
def api_static_section_update():
    path = _get_static_config_path()
    if not path or not os.path.exists(path):
        return jsonify({'error': 'Static config not found'}), 404
    req      = request.get_json(silent=True) or {}
    action   = req.get('action', '')
    section  = req.get('section', '')
    name     = str(req.get('name', '')).strip()
    old_name = str(req.get('old_name', name)).strip()
    payload  = req.get('data', {})
    if not action or not section or (action not in ('set', 'remove') and not name):
        return jsonify({'error': 'Missing required fields'}), 400
    current_raw = req.get('current_raw', '')
    try:
        _y = YAML()
        _y.preserve_quotes = True
        if current_raw:
            config = _y.load(StringIO(current_raw)) or {}
        else:
            with open(path, 'r') as f:
                config = _y.load(f) or {}
        if section == 'entrypoints':
            eps = config.setdefault('entryPoints', {})
            if action == 'remove':
                eps.pop(name, None)
            else:
                if action == 'edit' and old_name != name:
                    eps[name] = eps.pop(old_name, None)
                ep = eps.get(name)
                if not isinstance(ep, dict):
                    ep = {}
                addr = str(payload.get('address', '')).strip()
                if addr:
                    ep['address'] = DoubleQuotedScalarString(addr)
                elif 'address' not in ep:
                    ep['address'] = ''
                http_blk = ep.get('http') if isinstance(ep.get('http'), dict) else {}
                redirect_to = str(payload.get('redirect_to', '')).strip()
                if redirect_to:
                    http_blk['redirections'] = {'entryPoint': {'to': redirect_to, 'scheme': 'https', 'permanent': True}}
                else:
                    http_blk.pop('redirections', None)
                uhs = str(payload.get('underscore_headers', '')).strip().lower()
                if uhs in ('delete', 'reject'):
                    http_blk['underscoreHeadersStrategy'] = uhs
                else:
                    http_blk.pop('underscoreHeadersStrategy', None)
                if http_blk:
                    ep['http'] = http_blk
                else:
                    ep.pop('http', None)
                if payload.get('http3'):
                    ep['http3'] = {}
                else:
                    ep.pop('http3', None)
                eps[name] = ep
        elif section == 'resolvers':
            resolvers = config.setdefault('certificatesResolvers', {})
            if action == 'remove':
                resolvers.pop(name, None)
            else:
                if action == 'edit' and old_name != name:
                    resolvers.pop(old_name, None)
                ct   = payload.get('challenge_type', 'dnsChallenge')
                acme = {'email': payload.get('email', ''), 'storage': payload.get('storage', '/acme.json')}
                if ct == 'dnsChallenge':
                    acme['dnsChallenge'] = {'provider': payload.get('provider', '')}
                elif ct == 'httpChallenge':
                    acme['httpChallenge'] = {'entryPoint': payload.get('http_entrypoint', 'web')}
                else:
                    acme['tlsChallenge'] = {}
                resolvers[name] = {'acme': acme}
        elif section == 'plugins':
            plugins = config.setdefault('experimental', {}).setdefault('plugins', {})
            if action == 'remove':
                plugins.pop(name, None)
            else:
                if action == 'edit' and old_name != name:
                    plugins.pop(old_name, None)
                plugins[name] = {'moduleName': payload.get('moduleName', ''), 'version': payload.get('version', '')}
        elif section == 'api' and action == 'set':
            if payload.get('enabled', True):
                api_cfg = config.get('api')
                if not isinstance(api_cfg, dict):
                    api_cfg = {}
                if not payload.get('dashboard', True):
                    api_cfg['dashboard'] = False
                elif 'dashboard' in api_cfg:
                    api_cfg['dashboard'] = True
                if payload.get('insecure'):
                    api_cfg['insecure'] = True
                elif 'insecure' in api_cfg:
                    api_cfg['insecure'] = False
                if payload.get('debug'):
                    api_cfg['debug'] = True
                else:
                    api_cfg.pop('debug', None)
                config['api'] = api_cfg
            else:
                config.pop('api', None)
        elif section == 'log' and action == 'set':
            level = str(payload.get('level', 'ERROR')).upper()
            if level and level != 'ERROR':
                config['log'] = {'level': level}
            else:
                config.pop('log', None)
            if payload.get('accessLog'):
                al_path = str(payload.get('accessLogPath', '')).strip()
                config['accessLog'] = {'filePath': al_path} if al_path else {}
            else:
                config.pop('accessLog', None)
        elif section == 'providers' and action == 'set':
            providers = config.setdefault('providers', {})
            if payload.get('docker'):
                docker_cfg = {}
                endpoint = str(payload.get('dockerEndpoint', '')).strip()
                if endpoint and endpoint != 'unix:///var/run/docker.sock':
                    docker_cfg['endpoint'] = endpoint
                if payload.get('dockerExposedByDefault'):
                    docker_cfg['exposedByDefault'] = True
                if not payload.get('dockerWatch', True):
                    docker_cfg['watch'] = False
                providers['docker'] = docker_cfg
            else:
                providers.pop('docker', None)
            if payload.get('file'):
                file_cfg = {}
                directory = str(payload.get('fileDirectory', '')).strip()
                if directory:
                    file_cfg['directory'] = directory
                if not payload.get('fileWatch', True):
                    file_cfg['watch'] = False
                providers['file'] = file_cfg
            else:
                providers.pop('file', None)
            if not providers:
                config.pop('providers', None)
        elif section == 'providers' and action in ('add', 'edit', 'remove'):
            providers = config.setdefault('providers', {})
            if action == 'remove':
                providers.pop(name, None)
            else:
                if action == 'edit' and old_name and old_name != name:
                    providers.pop(old_name, None)
                prov_cfg = {}
                yaml_config = str(payload.get('yaml_config', '')).strip()
                if yaml_config:
                    try:
                        _yp = SafeYAML(typ='safe')
                        parsed = _yp.load(yaml_config)
                        if isinstance(parsed, dict):
                            prov_cfg = parsed
                    except Exception:
                        pass
                providers[name] = prov_cfg
            if not providers:
                config.pop('providers', None)
        else:
            return jsonify({'error': f'Unknown section: {section!r}'}), 400
        stream = StringIO()
        _y.dump(config, stream)
        new_raw = stream.getvalue()
        _y2 = SafeYAML(typ='safe')
        parsed = _y2.load(new_raw) or {}
        return jsonify({'ok': True, 'raw': new_raw, 'parsed': parsed})
    except Exception as e:
        logger.exception("Static section update failed")
        return jsonify({'error': str(e)}), 500


# Cloudflare edge ranges for forwardedHeaders.trustedIPs, captured 2026-07-23 from
# https://www.cloudflare.com/ips/ (https://www.cloudflare.com/ips-v4 + /ips-v6).
# Refresh on release: replace both lists from that source and bump _CLOUDFLARE_IPS_CAPTURED.
_CLOUDFLARE_IPS_CAPTURED = '2026-07-23'
_CLOUDFLARE_IPS_V4 = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
    '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
    '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
    '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
]
_CLOUDFLARE_IPS_V6 = [
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
    '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
]
_PRIVATE_IP_RANGES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7']




def _is_valid_cidr(cidr: str) -> bool:
    try:
        ipaddress.ip_network(str(cidr).strip(), strict=False)
        return True
    except ValueError:
        return False




def _parse_cidr_input(raw) -> list:
    if isinstance(raw, list):
        parts = [str(x) for x in raw]
    else:
        parts = re.split(r'[\s,]+', str(raw or ''))
    return [p.strip() for p in parts if p.strip()]


@app.route('/api/static/trusted-ips/preview', methods=['POST'])
@csrf_protect
@login_required
def api_static_trusted_ips_preview():
    req = request.get_json(silent=True) or {}
    current_raw = req.get('current_raw', '')
    entrypoint  = str(req.get('entrypoint', '')).strip()
    try:
        _y = YAML()
        _y.preserve_quotes = True
        if current_raw:
            config = _y.load(StringIO(current_raw)) or {}
        else:
            path = _get_static_config_path()
            if not path or not os.path.exists(path):
                return jsonify({'error': 'Static config not found'}), 404
            with open(path, 'r') as f:
                config = _y.load(f) or {}
        if not isinstance(config, dict):
            return jsonify({'error': 'Static config is not a mapping'}), 400
        ep_key = 'entryPoints' if 'entryPoints' in config else ('entrypoints' if 'entrypoints' in config else 'entryPoints')
        eps = config.get(ep_key)
        summary = []
        if isinstance(eps, dict):
            for nm, cfg in eps.items():
                cur = []
                addr = ''
                if isinstance(cfg, dict):
                    addr = str(cfg.get('address', ''))
                    fh = cfg.get('forwardedHeaders')
                    if isinstance(fh, dict) and isinstance(fh.get('trustedIPs'), list):
                        cur = [str(x) for x in fh['trustedIPs']]
                summary.append({'name': str(nm), 'address': addr, 'trusted_ips': cur})
        resp = {
            'ok': True,
            'entrypoints': summary,
            'cloudflare_captured': _CLOUDFLARE_IPS_CAPTURED,
            'cloudflare_ranges': _CLOUDFLARE_IPS_V4 + _CLOUDFLARE_IPS_V6,
            'private_ranges': _PRIVATE_IP_RANGES,
        }
        if not entrypoint:
            return jsonify(resp)
        if not isinstance(eps, dict) or entrypoint not in eps:
            return jsonify({'error': f'Entrypoint "{entrypoint}" not found in static config'}), 400
        custom  = _parse_cidr_input(req.get('custom_cidrs', []))
        invalid = [c for c in custom if not _is_valid_cidr(c)]
        additions = []
        if req.get('cloudflare'):
            additions += _CLOUDFLARE_IPS_V4 + _CLOUDFLARE_IPS_V6
        if req.get('private'):
            additions += _PRIVATE_IP_RANGES
        additions += [c for c in custom if _is_valid_cidr(c)]
        ep = eps.get(entrypoint)
        if not isinstance(ep, dict):
            ep = {}
        fh = ep.get('forwardedHeaders') if isinstance(ep.get('forwardedHeaders'), dict) else {}
        cur_seq = fh.get('trustedIPs')
        existing = [str(x) for x in cur_seq] if isinstance(cur_seq, list) else []
        final, added = _merge_trusted_ips(existing, additions)
        if isinstance(cur_seq, list):
            for c in added:
                cur_seq.append(DoubleQuotedScalarString(c))
        else:
            fh['trustedIPs'] = [DoubleQuotedScalarString(c) for c in final]
        ep['forwardedHeaders'] = fh
        eps[entrypoint] = ep
        stream = StringIO()
        _y.dump(config, stream)
        new_raw = stream.getvalue()
        parsed = SafeYAML(typ='safe').load(new_raw) or {}
        resp.update({
            'entrypoint': entrypoint,
            'existing': existing,
            'added': added,
            'final': final,
            'invalid': invalid,
            'raw': new_raw,
            'parsed': parsed,
        })
        return jsonify(resp)
    except Exception as e:
        logger.exception("Trusted IPs preview failed")
        return jsonify({'error': str(e)}), 500



@app.route('/api/tools/digestauth', methods=['POST'])
@login_required
def api_digestauth():
    import hashlib
    data     = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    realm    = data.get('realm', '').strip()
    password = data.get('password', '')
    if not username or not realm or not password:
        return jsonify({'ok': False, 'error': 'username, realm and password required'}), 400
    h = hashlib.md5(f'{username}:{realm}:{password}'.encode()).hexdigest()
    return jsonify({'ok': True, 'hash': f'{username}:{realm}:{h}'})

@app.route('/api/tools/htpasswd', methods=['POST'])
@login_required
def api_htpasswd():
    import random, string
    data     = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'ok': False, 'error': 'username and password required'}), 400
    salt = ''.join(random.choices(string.ascii_letters + string.digits + './', k=8))
    h    = _apr1_hash(password, salt)
    return jsonify({'ok': True, 'hash': f'{username}:{h}'})

@app.route('/api/geoip/status')
@login_required
def api_geoip_status():
    return jsonify(_geoip_status())

@app.route('/api/geoip/lookup', methods=['POST'])
@csrf_protect
@login_required
def api_geoip_lookup():
    if not _geoip_enabled():
        return jsonify({'enabled': False, 'available': False, 'results': {}})
    data = request.get_json(silent=True) or {}
    ips  = data.get('ips') or []
    if not isinstance(ips, list):
        ips = []
    reader = _geoip_reader()
    available = reader is not None
    results = {}
    if available:
        for ip in ips[:2000]:
            ip = str(ip).strip()
            if not ip or ip in results:
                continue
            geo = _geoip_lookup(ip, reader)
            if geo:
                results[ip] = geo
    return jsonify({'enabled': True, 'available': available, 'results': results})

@app.route('/api/geoip/update', methods=['POST'])
@csrf_protect
@login_required
@limiter.limit("6 per hour")
def api_geoip_update():
    ok, info = _geoip_download()
    if ok:
        add_notification('success', f'GeoIP database updated (DB-IP {info})')
        return jsonify({'success': True, 'db_month': info, 'status': _geoip_status()})
    return jsonify({'success': False, 'error': f'Download failed: {info}'}), 502

@app.route('/api/setup/test-connection', methods=['POST'])
@login_required
def api_setup_test_connection():
    settings = load_settings()
    if settings.get('setup_complete', False):
        return jsonify({'ok': False, 'error': 'Setup already complete'}), 403
    data    = request.get_json(silent=True) or {}
    raw_url = str(data.get('url', '')).strip()
    url     = _safe_api_url(raw_url)
    if not url:
        return jsonify({'ok': False, 'error': 'Invalid URL'}), 400
    if not _ssrf_ok(url):
        return jsonify({'ok': False, 'error': 'Target address not allowed'}), 400
    u = str(data.get('user', '')).strip()
    p = str(data.get('password', '')).strip()
    auth = (u, p) if u and p else None
    try:
        resp = requests.get(f"{url}/api/version", timeout=4, auth=auth, verify=_traefik_verify())
        if resp.status_code == 200:
            info = resp.json()
            return jsonify({'ok': True, 'version': info.get('Version', '?')})
        if resp.status_code in (401, 403):
            return jsonify({'ok': False, 'error': f'HTTP {resp.status_code} - check the API username and password'})
        return jsonify({'ok': False, 'error': f'HTTP {resp.status_code} from {url}/api/version'})
    except requests.exceptions.SSLError as e:
        return jsonify({'ok': False, 'error': f'TLS verification failed - the API certificate is not trusted. Mount your CA into /etc/ssl/certs/ca-certificates.crt or set TRAEFIK_INSECURE_SKIP_VERIFY=true. ({str(e)[:120]})'})
    except requests.exceptions.Timeout:
        return jsonify({'ok': False, 'error': 'Connection timed out - the API URL may be unreachable from the container'})
    except requests.exceptions.ConnectionError as e:
        return jsonify({'ok': False, 'error': f'Connection error - check the URL and network. ({str(e)[:120]})'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:160]})


@app.route('/api/traefik/router/<protocol>/<path:name>')
@login_required
def api_router_detail(protocol, name):
    proto = {'http': 'http', 'tcp': 'tcp', 'udp': 'udp'}.get(protocol.lower(), 'http')
    return jsonify(traefik_api_get(f'/api/{proto}/routers/{name}') or {})

@app.route('/api/traefik/plugins')
@login_required
def api_plugins():
    static_path = _get_static_config_path()
    if not os.path.exists(static_path):
        return jsonify({'plugins': [], 'error': f'Static config not found at {static_path}. Set STATIC_CONFIG_PATH env var or configure the path in Settings.'})
    try:
        with open(static_path, 'r') as f:
            static = yaml.load(f) or {}
        raw = (static.get('experimental') or {}).get('plugins') or {}
        plugins = [
            {'name': n, 'moduleName': i.get('moduleName',''), 'version': i.get('version',''), 'settings': i.get('settings')}
            for n, i in raw.items() if isinstance(i, dict)
        ]
        return jsonify({'plugins': plugins})
    except Exception as e:
        logger.exception("Error reading static config")
        return jsonify({'plugins': [], 'error': str(e)})

@app.route('/api/plugins/install', methods=['POST'])
@csrf_protect
@login_required
def api_plugins_install():
    data = request.get_json(silent=True) or {}
    static_yaml = (data.get('static_yaml') or '').strip()
    middleware_yaml = (data.get('middleware_yaml') or '').strip()
    if not static_yaml:
        return jsonify({'ok': False, 'error': 'Paste the static config snippet'}), 400
    try:
        _ys = SafeYAML(typ='safe')
        parsed_static = _ys.load(static_yaml) or {}
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Invalid static config YAML: {e}'}), 400
    plugins_block = None
    if isinstance(parsed_static.get('experimental'), dict):
        plugins_block = parsed_static['experimental'].get('plugins')
    if not plugins_block and 'plugins' in parsed_static:
        plugins_block = parsed_static['plugins']
    if not plugins_block or not isinstance(plugins_block, dict):
        return jsonify({'ok': False, 'error': 'Could not find plugins block - paste the experimental.plugins YAML from the Traefik plugin page'}), 400
    static_path = _get_static_config_path()
    if not static_path or not os.path.exists(static_path):
        return jsonify({'ok': False, 'error': 'Static config not found'}), 404
    try:
        _ry = YAML()
        _ry.preserve_quotes = True
        with open(static_path, 'r') as f:
            config = _ry.load(f) or {}
        if 'experimental' not in config:
            config['experimental'] = {}
        if 'plugins' not in config['experimental']:
            config['experimental']['plugins'] = {}
        for plugin_name, plugin_data in plugins_block.items():
            config['experimental']['plugins'][plugin_name] = {
                'moduleName': plugin_data.get('moduleName', ''),
                'version': plugin_data.get('version', ''),
            }
        create_backup(static_path)
        stream = StringIO()
        _ry.dump(config, stream)
        with open(static_path, 'w') as f:
            f.write(stream.getvalue())
    except Exception as e:
        logger.exception("Failed to save plugin to static config")
        return jsonify({'ok': False, 'error': str(e)}), 500
    warning = None
    if middleware_yaml and ACTIVE_CONFIG_DIR:
        if '{{' in middleware_yaml:
            return jsonify({'ok': False, 'error': 'The middleware snippet contains template placeholders ({{ ... }}) that must be replaced with real values before saving. Edit the middleware in the editor and replace all {{ }} placeholders.'}), 400
        try:
            _ym = SafeYAML(typ='safe')
            parsed_mw = _ym.load(middleware_yaml) or {}
            if isinstance(parsed_mw.get('http'), dict):
                middlewares = parsed_mw['http'].get('middlewares') or {}
            elif 'middlewares' in parsed_mw:
                middlewares = parsed_mw['middlewares']
            else:
                middlewares = {}
            if middlewares and isinstance(middlewares, dict):
                mw_file = os.path.join(ACTIVE_CONFIG_DIR, 'plugin-middlewares.yml')
                existing = {}
                if os.path.exists(mw_file):
                    with open(mw_file, 'r') as f:
                        existing = yaml.load(f) or {}
                if 'http' not in existing:
                    existing['http'] = {}
                if 'middlewares' not in existing['http']:
                    existing['http']['middlewares'] = {}
                existing['http']['middlewares'].update(middlewares)
                stream = StringIO()
                yaml.dump(existing, stream)
                with open(mw_file, 'w') as f:
                    f.write(stream.getvalue())
        except Exception as e:
            logger.exception("Failed to save middleware")
            warning = f'Plugin saved but middleware could not be written: {e}'
    plugin_names = list(plugins_block.keys())
    add_notification('success', f'Plugin installed: {", ".join(plugin_names)}')
    result = {'ok': True, 'plugins': plugin_names}
    if warning:
        result['warning'] = warning
    return jsonify(result)




@app.route('/api/traefik/certs')
@login_required
def api_certs():
    import json as _json
    certs = []
    errors = []

    acme_paths = _settings.get_acme_json_paths()
    found_any  = False
    for configured in acme_paths:
        acme_path = _readable_config_path(configured)
        if not (acme_path and os.path.exists(acme_path)):
            errors.append(f'acme.json not found at {configured}.')
            continue
        found_any = True
        try:
            with open(acme_path, 'r') as f:
                raw = f.read().strip()
            acme_data = _json.loads(raw) if raw else {}
            for resolver_name, resolver_data in acme_data.items():
                if not isinstance(resolver_data, dict):
                    continue
                for c in (resolver_data.get('Certificates') or resolver_data.get('certificates') or []):
                    domain    = c.get('domain', {})
                    not_after = _parse_cert_expiry(c.get('certificate', ''))
                    certs.append({'resolver': resolver_name, 'main': domain.get('main', ''),
                                  'sans': domain.get('sans', []) or [], 'not_after': not_after,
                                  'source': os.path.basename(acme_path)})
        except PermissionError:
            errors.append(f'Permission denied reading {acme_path}. Run: chmod o+r {acme_path}')
        except Exception as e:
            logger.exception("Error reading acme.json")
            errors.append(f'{os.path.basename(acme_path)}: {e}')
    if not acme_paths or not found_any:
        errors.append('Set ACME_JSON_PATH env var or configure the path in Settings. '
                      'Several files can be given comma-separated, or point it at a directory.')

    certs.extend(_certs_from_tls_configs())

    if not certs and errors:
        return jsonify({'certs': [], 'error': ' | '.join(errors)})
    return jsonify({'certs': certs})

@app.route('/api/traefik/logs')
@login_required
def api_logs():
    try:
        lines_req = min(int(request.args.get('lines', 100)), 1000)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid lines parameter'}), 400
    log_path = _readable_config_path(_get_access_log_path())
    if not log_path or not os.path.exists(log_path):
        return jsonify({'error': 'Access log not found. Set ACCESS_LOG_PATH env var or configure the path in Settings.', 'lines': []})
    try:
        lines = []
        buf_size = 8192
        with open(log_path, 'rb') as f:
            f.seek(0, 2)
            remaining = f.tell()
            partial = b''
            while remaining > 0 and len(lines) < lines_req:
                chunk = min(buf_size, remaining)
                remaining -= chunk
                f.seek(remaining)
                data = f.read(chunk) + partial
                split = data.split(b'\n')
                partial = split[0]
                lines = split[1:] + lines
            if partial:
                lines = [partial] + lines
        result = [l.decode('utf-8', errors='replace').rstrip() for l in lines[-lines_req:] if l]
        return jsonify({'lines': result})
    except Exception as e:
        return jsonify({'error': str(e), 'lines': []})






def list_backups():
    ensure_backup_dir()
    static_path = _get_static_config_path()
    static_base = os.path.basename(static_path) if static_path else None
    _name_re    = re.compile(r'^(.+)\.(\d{8}_\d{6})\.bak$')
    backups = []
    for f in os.listdir(BACKUP_DIR):
        if f.endswith('.bak'):
            path = os.path.join(BACKUP_DIR, f)
            st   = os.stat(path)
            m    = _name_re.match(f)
            orig   = m.group(1) if m else ''
            ts_str = m.group(2) if m else ''
            kind = 'static' if static_base and orig == static_base else 'routes'
            backups.append({
                'name':     f,
                'size':     st.st_size,
                'modified': time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
                'sort_key': ts_str or str(st.st_mtime),
                'kind':     kind,
            })
    backups.sort(key=lambda b: b['sort_key'], reverse=True)
    for b in backups:
        del b['sort_key']
    return backups

_BACKUP_RE = re.compile(r'^[a-zA-Z0-9._ -]+\.yml\.\d{8}_\d{6}\.bak$')

def _validated_backup_path(filename: str) -> str:
    if not _BACKUP_RE.match(filename):
        logger.warning(f"Invalid backup filename rejected: {filename!r}")
        abort(400)
    path = os.path.realpath(os.path.join(BACKUP_DIR, filename))
    if not path.startswith(os.path.realpath(BACKUP_DIR)):
        logger.warning(f"Path traversal attempt blocked: {filename!r}")
        abort(400)
    return path



















def _git_req_agent():
    agent_id = (request.args.get('agent_id') or '').strip()
    if not agent_id:
        return None, False
    return _agent_by_id(agent_id), True

@app.route('/api/backup/git/status')
@login_required
def api_git_backup_status():
    agent, wanted = _git_req_agent()
    if wanted and not agent:
        return jsonify({'error': 'Agent not found'}), 404
    s          = load_settings()
    configured = bool(s.get('git_backup_repo', '').strip())
    repo_dir   = _git_agent_repo_dir(agent['id']) if agent else _git_repo_dir()
    result     = {'enabled': bool(s.get('git_backup_enabled')), 'configured': configured, 'last_sha': None, 'last_push': None}
    if agent:
        result['branch'] = _agent_git_branch(agent)
    if configured and os.path.exists(os.path.join(repo_dir, '.git')):
        out, _, rc = _git_run(['log', '-1', '--format=%H|%ci|%s'], cwd=repo_dir)
        if rc == 0 and '|' in out:
            parts = out.split('|', 2)
            result['last_sha']  = parts[0][:8]
            result['last_push'] = parts[1].strip() if len(parts) > 1 else None
    return jsonify(result)

@app.route('/api/backup/git/push', methods=['POST'])
@csrf_protect
@login_required
def api_git_backup_push():
    agent, wanted = _git_req_agent()
    if wanted and not agent:
        return jsonify({'error': 'Agent not found'}), 404
    data    = request.get_json(silent=True) or {}
    message = str(data.get('message', '')).strip()
    if agent:
        ok, err = _git_push_agent_configs(agent, 'manual', custom_message=message or None)
    else:
        ok, err = _git_push_configs('manual', custom_message=message or None)
    if ok:
        add_notification('success', f"Git backup pushed ({agent['name']})" if agent else 'Git backup pushed')
        return jsonify({'ok': True})
    add_notification('error', f'Git push failed: {err}')
    return jsonify({'ok': False, 'error': err}), 400

@app.route('/api/backup/git/test', methods=['POST'])
@csrf_protect
@login_required
def api_git_backup_test():
    body     = request.get_json(silent=True) or {}
    s        = load_settings()
    repo_url = (body.get('repo_url') or s.get('git_backup_repo', '')).strip()
    username = (body.get('username') or s.get('git_backup_username', '')).strip()
    token    = (body.get('token') or s.get('git_backup_token', '')).strip()
    if not repo_url:
        return jsonify({'ok': False, 'error': 'No repository URL configured'}), 400
    if not _valid_git_url(repo_url):
        return jsonify({'ok': False, 'error': 'Unsupported URL - use https://, http://, ssh:// or git://'}), 400
    creds = {'username': username, 'token': token} if token else None
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        _, err, rc = _git_run(['ls-remote', '--quiet', '--', repo_url], cwd=tmpdir, credentials=creds)
    if rc == 0:
        return jsonify({'ok': True})
    safe_err = err.replace(token, '***') if token else err
    return jsonify({'ok': False, 'error': safe_err or 'Could not reach repository'}), 400

@app.route('/api/backup/git/commits')
@login_required
def api_git_backup_commits():
    agent, wanted = _git_req_agent()
    if wanted and not agent:
        return jsonify([])
    repo_dir = _git_agent_repo_dir(agent['id']) if agent else _git_repo_dir()
    if not os.path.exists(os.path.join(repo_dir, '.git')):
        return jsonify([])
    out, _, rc = _git_run(['log', '--format=%H|%ci|%s', '-50'], cwd=repo_dir)
    if rc != 0:
        return jsonify([])
    commits = []
    for line in out.splitlines():
        parts = line.split('|', 2)
        if len(parts) == 3:
            commits.append({'sha': parts[0], 'sha_short': parts[0][:8], 'timestamp': parts[1].strip(), 'message': parts[2].strip()})
    return jsonify(commits)

@app.route('/api/backup/git/commit/<sha>/diff')
@login_required
def api_git_backup_diff(sha):
    if not re.match(r'^[0-9a-f]{7,40}$', sha):
        abort(400)
    agent, wanted = _git_req_agent()
    if wanted and not agent:
        return jsonify({'stat': '', 'files': []})
    repo_dir = _git_agent_repo_dir(agent['id']) if agent else _git_repo_dir()
    if not os.path.exists(os.path.join(repo_dir, '.git')):
        return jsonify({'stat': '', 'files': []})
    try:
        stat, _, _ = _git_run(['show', '--stat', '--format=', sha], cwd=repo_dir)
        changed, _, rc = _git_run(['diff-tree', '--no-commit-id', '-r', '--name-status', sha], cwd=repo_dir)
        files = []
        for line in changed.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split('\t', 1)
            if len(parts) != 2:
                continue
            status, filename = parts[0].strip(), parts[1].strip()
            new_content, _, new_rc = _git_run(['show', f'{sha}:{filename}'], cwd=repo_dir)
            old_content, _, old_rc = _git_run(['show', f'{sha}^:{filename}'], cwd=repo_dir)
            files.append({
                'filename': filename,
                'status':   status,
                'old':      old_content if old_rc == 0 else '',
                'new':      new_content if new_rc == 0 else '',
            })
        return jsonify({'stat': stat, 'files': files})
    except Exception as e:
        logger.exception("Git diff error")
        return jsonify({'error': str(e)}), 500


@app.route('/api/backup/git/restore/<sha>', methods=['POST'])
@csrf_protect
@login_required
def api_git_backup_restore(sha):
    if not re.match(r'^[0-9a-f]{7,40}$', sha):
        abort(400)
    agent, wanted = _git_req_agent()
    if wanted and not agent:
        return jsonify({'error': 'Agent not found'}), 404
    repo_dir = _git_agent_repo_dir(agent['id']) if agent else _git_repo_dir()
    if not os.path.exists(os.path.join(repo_dir, '.git')):
        return jsonify({'error': 'Git repo not initialized'}), 400
    try:
        if agent:
            out, _, rc = _git_run(['ls-tree', '-r', '--name-only', sha, 'dynamic/'], cwd=repo_dir)
            if rc != 0:
                return jsonify({'error': 'Commit not found'}), 404
            restored = 0
            for fpath in out.splitlines():
                fpath = fpath.strip()
                if not fpath:
                    continue
                content, _, src = _git_run(['show', f'{sha}:{fpath}'], cwd=repo_dir)
                if src == 0:
                    resp = _agent_request(agent, 'POST', '/api/configs', json={'name': os.path.basename(fpath), 'content': content})
                    resp.raise_for_status()
                    restored += 1
            add_notification('warning', f"Restored {agent['name']} from git commit {sha[:8]} ({restored} files)")
            return jsonify({'ok': True})
        for p in env.CONFIG_PATHS:
            create_backup(p)
        sp = _get_static_config_path()
        if sp:
            create_backup(sp)
        for p in env.CONFIG_PATHS:
            base    = os.path.basename(p)
            content = _git_show_first(repo_dir, sha, [f'dynamic/{base}', base])
            if content:
                with open(p, 'w') as f:
                    f.write(content)
        if sp:
            base    = os.path.basename(sp)
            content = _git_show_first(repo_dir, sha, [f'static/{base}', base])
            if content:
                with open(sp, 'w') as f:
                    f.write(content)
        add_notification('warning', f'Restored from git commit {sha[:8]}')
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception("Git restore error")
        add_notification('error', f'Git restore failed: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/backup/git/repo', methods=['DELETE'])
@csrf_protect
@login_required
def api_git_backup_reset():
    agent, wanted = _git_req_agent()
    if wanted and not agent:
        return jsonify({'error': 'Agent not found'}), 404
    repo_dir = _git_agent_repo_dir(agent['id']) if agent else _git_repo_dir()
    try:
        if os.path.exists(repo_dir):
            shutil.rmtree(repo_dir)
        logger.info("Git repo directory reset by user")
        add_notification('warning', 'Git repository reset - re-initialize by pushing again')
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception("Git repo reset error")
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications')
@login_required
def api_notifications():
    with _notif_lock:
        entries = list(reversed(list(_notifications)))
    return jsonify(entries)

@app.route('/api/notifications/delete', methods=['POST'])
@login_required
def api_notifications_delete():
    _check_csrf()
    ts = (request.get_json(silent=True) or {}).get('ts', '')
    if not ts:
        return jsonify({'ok': False, 'message': 'Missing ts'}), 400
    with _notif_lock:
        for i, entry in enumerate(list(_notifications)):
            if entry.get('ts') == ts:
                del _notifications[i]
                break
    threading.Thread(target=_save_notifications_bg, daemon=True).start()
    return jsonify({'ok': True})

@app.route('/api/notifications/clear', methods=['POST'])
@login_required
def api_notifications_clear():
    _check_csrf()
    with _notif_lock:
        _notifications.clear()
    threading.Thread(target=_save_notifications_bg, daemon=True).start()
    return jsonify({'ok': True})

@app.route('/api/notifications/add', methods=['POST'])
@login_required
def api_notifications_add():
    _check_csrf()
    data = request.get_json(silent=True) or {}
    type_ = data.get('type', 'info')
    msg   = (data.get('message') or '').strip()
    if not msg:
        return jsonify({'ok': False, 'error': 'message required'}), 400
    add_notification(type_, msg)
    return jsonify({'ok': True})

@app.route('/api/notifications/update', methods=['POST'])
@csrf_protect
@login_required
def api_notifications_update():
    version = (request.get_json(silent=True) or {}).get('version', '')
    if version:
        add_notification('info', f"Traefik Manager v{version} is available - update now")
    return jsonify({'ok': True})

@app.route('/api/tls-options')
@login_required
def api_tls_options_list():
    opts = []
    for p in env.CONFIG_PATHS:
        config = _load_config_display(p)
        short = os.path.basename(p) if (env.MULTI_CONFIG or ACTIVE_CONFIG_DIR) else ''
        for name, data in (config.get('tls') or {}).get('options', {}).items():
            data = data or {}
            buf = StringIO()
            yaml.dump({'tls': {'options': {name: data}}}, buf)
            ca = data.get('clientAuth') or {}
            opts.append({
                'name': name,
                'configFile': short,
                'configFilePath': p,
                'minVersion': data.get('minVersion', ''),
                'maxVersion': data.get('maxVersion', ''),
                'sniStrict': bool(data.get('sniStrict', False)),
                'cipherSuites': data.get('cipherSuites', []),
                'curvePreferences': data.get('curvePreferences', []),
                'alpnProtocols': data.get('alpnProtocols', []),
                'clientAuthType': ca.get('clientAuthType', ''),
                'clientAuthCAs': ca.get('caFiles', []),
                'yaml': buf.getvalue(),
            })
    return jsonify(opts)


@app.route('/api/tls-options', methods=['POST'])
@csrf_protect
@login_required
def api_tls_options_save():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    config_file = data.get('configFile', '').strip()
    if not name:
        return jsonify({'ok': False, 'message': 'Profile name is required'}), 400
    target_path = _resolve_config_path(config_file) or env.CONFIG_PATH
    create_backup(target_path)
    config = load_config(target_path)
    opts = {}
    if data.get('minVersion'):
        opts['minVersion'] = data['minVersion']
    if data.get('maxVersion'):
        opts['maxVersion'] = data['maxVersion']
    if data.get('sniStrict'):
        opts['sniStrict'] = True
    ciphers = [c.strip() for c in (data.get('cipherSuites') or []) if c.strip()]
    if ciphers:
        opts['cipherSuites'] = ciphers
    curves = [c.strip() for c in (data.get('curvePreferences') or []) if c.strip()]
    if curves:
        opts['curvePreferences'] = curves
    alpn = [c.strip() for c in (data.get('alpnProtocols') or []) if c.strip()]
    if alpn:
        opts['alpnProtocols'] = alpn
    ca_type = data.get('clientAuthType', '').strip()
    ca_cas = [c.strip() for c in (data.get('clientAuthCAs') or []) if c.strip()]
    if ca_type and ca_type != 'NoClientCert':
        ca_obj = {'clientAuthType': ca_type}
        if ca_cas:
            ca_obj['caFiles'] = ca_cas
        opts['clientAuth'] = ca_obj
    config.setdefault('tls', {}).setdefault('options', {})[name] = opts
    save_config(_strip_empty_sections(config), target_path)
    add_notification('success', f"TLS profile '{name}' saved")
    return jsonify({'ok': True})


@app.route('/api/tls-options/<name>', methods=['DELETE'])
@csrf_protect
@login_required
def api_tls_options_delete(name):
    config_file = request.args.get('configFile', '').strip()
    target_path = _resolve_config_path(config_file) or env.CONFIG_PATH
    config = load_config(target_path)
    tls_opts = (config.get('tls') or {}).get('options', {})
    if name not in tls_opts:
        return jsonify({'ok': False, 'message': 'Profile not found'}), 404
    create_backup(target_path)
    del tls_opts[name]
    save_config(_strip_empty_sections(config), target_path)
    add_notification('success', f"TLS profile '{name}' deleted")
    return jsonify({'ok': True})


@app.route('/api/backups')
@login_required
def api_backups():
    return jsonify(list_backups())

@app.route('/api/restore/<filename>', methods=['POST'])
@limiter.limit("10 per minute")
@csrf_protect
@login_required
def api_restore(filename):
    try:
        path = _validated_backup_path(filename)
        if not os.path.exists(path):
            return jsonify({'error': 'Backup not found'}), 404
        # Infer the target config file from the backup filename (basename.yml.ts.bak)
        # Strip the timestamp suffix to get the original basename
        bname = filename  # e.g. dynamic.yml.20260325_120000.bak
        # Find matching config path by basename prefix
        target_path = env.CONFIG_PATH
        for p in env.CONFIG_PATHS:
            if bname.startswith(os.path.basename(p) + '.'):
                target_path = p
                break
        create_backup(target_path)
        shutil.copy2(path, target_path)
        logger.info(f"Restored: {filename} → {target_path}")
        add_notification('warning', f"Backup restored: {filename}")
        return jsonify({'success': True})
    except Exception as e:
        logger.exception("Restore error")
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/create', methods=['POST'])
@csrf_protect
@login_required
def api_backup_create():
    try:
        created = []
        for p in env.CONFIG_PATHS:
            dest = create_backup(p)
            if dest:
                created.append(os.path.basename(dest))
        if created:
            add_notification('success', f"Backup created ({len(created)} file{'s' if len(created) > 1 else ''})")
            return jsonify({'success': True, 'names': created, 'count': len(created)})
        return jsonify({'error': 'No config files found to backup'}), 400
    except Exception as e:
        logger.exception("Backup create error")
        return jsonify({'error': str(e)}), 500

@app.route('/api/static/backup/create', methods=['POST'])
@csrf_protect
@login_required
def api_static_backup_create():
    path = _get_static_config_path()
    if not path:
        return jsonify({'error': 'STATIC_CONFIG_PATH not configured'}), 400
    try:
        dest = create_backup(path)
        if dest:
            add_notification('success', "Static config backup created")
            return jsonify({'success': True, 'name': os.path.basename(dest)})
        return jsonify({'error': 'Static config file not found'}), 400
    except Exception as e:
        logger.exception("Static backup create error")
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/static/create', methods=['POST'])
@csrf_protect
@login_required
def api_backup_static_create_alias():
    return api_static_backup_create()


@app.route('/api/backup/delete/<filename>', methods=['POST'])
@csrf_protect
@login_required
def api_backup_delete(filename):
    try:
        path = _validated_backup_path(filename)
        if os.path.exists(path):
            os.remove(path)
        add_notification('warning', f"Backup deleted: {filename}")
        return jsonify({'success': True})
    except Exception as e:
        logger.exception("Backup delete error")
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings', methods=['GET'])
@login_required
def api_get_settings():
    s = load_settings()

    s.pop('password_hash', None)
    s.pop('oidc_client_secret', None)
    s.pop('webhook_password', None)
    s.pop('crowdsec_api_key', None)
    s.pop('crowdsec_machine_password', None)
    s.pop('traefik_api_password', None)
    s.pop('otp_secret', None)
    s.pop('agents', None)
    s['traefik_api_password_set'] = bool(load_settings().get('traefik_api_password', ''))
    s['auth_enabled']             = _auth_enabled()
    s['oidc_active']            = _oidc_active()
    s['no_auth']                = not _auth_required()
    s['has_password']           = _has_password_set()
    s['auth_env_forced']        = os.environ.get('AUTH_ENABLED', '').strip().lower() in ('false', '0', 'no')
    s['oidc_client_secret_set'] = bool(load_settings().get('oidc_client_secret', ''))
    s['crowdsec_api_key_set']   = bool(_cs_api_key())
    s['crowdsec_machine_password_set'] = bool(_cs_machine_password())
    s['crowdsec_enabled']       = bool(_cs_lapi_url() and _cs_api_key())
    s['git_backup_token_set']   = bool(s.get('git_backup_token', ''))
    s.pop('git_backup_token', None)
    return jsonify(s)

@app.route('/api/settings', methods=['POST'])
@csrf_protect
@login_required
def api_save_settings():
    try:
        data        = request.get_json()
        domains_raw = data.get('domains', '')
        domains     = [d.strip() for d in (domains_raw if isinstance(domains_raw, list) else str(domains_raw).split(',')) if str(d).strip()]
        if not domains:
            return jsonify({'error': 'At least one domain is required'}), 400
        cert_resolver   = str(data.get('cert_resolver', 'cloudflare')).strip()
        traefik_api_url = _safe_api_url(str(data.get('traefik_api_url', 'http://traefik:8080')))
        if not traefik_api_url:
            return jsonify({'error': 'Invalid traefik_api_url - must start with http:// or https://'}), 400
        acme_json_path    = str(data.get('acme_json_path', '')).strip()
        access_log_path   = str(data.get('access_log_path', '')).strip()
        static_config_path = str(data.get('static_config_path', '')).strip()
        webhook_url          = str(data.get('webhook_url', '')).strip()
        webhook_type         = str(data.get('webhook_type', 'discord')).strip()
        webhook_username     = str(data.get('webhook_username', '')).strip()
        webhook_password     = str(data.get('webhook_password', ''))
        crowdsec_lapi_url    = str(data.get('crowdsec_lapi_url', '')).strip()
        crowdsec_api_key     = str(data.get('crowdsec_api_key', ''))
        crowdsec_machine_id       = str(data.get('crowdsec_machine_id', '')).strip()
        crowdsec_machine_password = str(data.get('crowdsec_machine_password', ''))
        traefik_api_user          = str(data.get('traefik_api_user', '')).strip()
        traefik_api_password      = str(data.get('traefik_api_password', ''))
        git_backup_enabled        = bool(data['git_backup_enabled'])        if 'git_backup_enabled'        in data else None
        git_backup_repo           = str(data['git_backup_repo']).strip()   if 'git_backup_repo'           in data else None
        if git_backup_repo and not _valid_git_url(git_backup_repo):
            return jsonify({'error': 'Invalid git repository URL - must start with https://, http://, ssh:// or git://'}), 400
        git_backup_branch         = (str(data['git_backup_branch']).strip() or 'main') if 'git_backup_branch' in data else None
        git_backup_username       = str(data['git_backup_username']).strip() if 'git_backup_username'      in data else None
        git_backup_token          = str(data.get('git_backup_token', ''))
        git_backup_commit_message = (str(data['git_backup_commit_message']).strip() or 'traefik-manager: {action} at {timestamp}') if 'git_backup_commit_message' in data else None
        git_backup_auto_push      = bool(data['git_backup_auto_push'])     if 'git_backup_auto_push'      in data else None
        backup_keep_count         = max(0, int(data['backup_keep_count'])) if str(data.get('backup_keep_count', '')).strip() != '' else None
        default_theme             = str(data['default_theme']).strip().lower() if 'default_theme' in data else None
        existing = load_settings()
        if not webhook_password:
            webhook_password = existing.get('webhook_password', '')
        if not crowdsec_api_key:
            crowdsec_api_key = existing.get('crowdsec_api_key', '')
        if not crowdsec_machine_password:
            crowdsec_machine_password = existing.get('crowdsec_machine_password', '')
        if not traefik_api_password:
            traefik_api_password = existing.get('traefik_api_password', '')
        if not git_backup_token:
            git_backup_token = existing.get('git_backup_token', '')
        save_settings(domains, cert_resolver, traefik_api_url,
                      auth_enabled=existing['auth_enabled'],
                      password_hash=existing['password_hash'],
                      visible_tabs=existing['visible_tabs'],
                      acme_json_path=acme_json_path,
                      access_log_path=access_log_path,
                      static_config_path=static_config_path,
                      webhook_url=webhook_url,
                      webhook_type=webhook_type,
                      webhook_username=webhook_username,
                      webhook_password=webhook_password,
                      crowdsec_lapi_url=crowdsec_lapi_url,
                      crowdsec_api_key=crowdsec_api_key,
                      crowdsec_machine_id=crowdsec_machine_id,
                      crowdsec_machine_password=crowdsec_machine_password,
                      traefik_api_user=traefik_api_user,
                      traefik_api_password=traefik_api_password,
                      git_backup_enabled=git_backup_enabled,
                      git_backup_repo=git_backup_repo,
                      git_backup_branch=git_backup_branch,
                      git_backup_username=git_backup_username,
                      git_backup_token=git_backup_token,
                      git_backup_commit_message=git_backup_commit_message,
                      git_backup_auto_push=git_backup_auto_push,
                      backup_keep_count=backup_keep_count,
                      default_theme=default_theme)
        result = load_settings()
        for _k in ('password_hash', 'oidc_client_secret', 'crowdsec_api_key',
                   'crowdsec_machine_password', 'traefik_api_password', 'git_backup_token',
                   'webhook_password', 'otp_secret', 'agents'):
            result.pop(_k, None)
        return jsonify({'success': True, 'settings': result})
    except Exception as e:
        logger.exception("Settings save error")
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/webhook-test', methods=['POST'])
@csrf_protect
@login_required
def api_webhook_test():
    data     = request.get_json(silent=True) or {}
    url      = str(data.get('url', '')).strip()
    wtype    = str(data.get('webhook_type', 'discord')).strip()
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))
    if not url or not url.startswith(('http://', 'https://')):
        return jsonify({'ok': False, 'error': 'Invalid URL'}), 400
    if not _ssrf_ok(url):
        return jsonify({'ok': False, 'error': 'Target address not allowed'}), 400
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    try:
        _send_webhook(url, wtype, 'info', 'Traefik Manager webhook test', ts, username, password)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:120]})

@app.route('/api/settings/test-connection', methods=['POST'])
@csrf_protect
@login_required
def api_settings_test_connection():
    data    = request.get_json(silent=True) or {}
    raw_url = str(data.get('url', '')).strip()
    url     = _safe_api_url(raw_url)
    if not url:
        return jsonify({'ok': False, 'error': 'Invalid URL'}), 400
    if not _ssrf_ok(url):
        return jsonify({'ok': False, 'error': 'Target address not allowed'}), 400
    u = str(data.get('user', '')).strip()
    p = str(data.get('password', '')).strip()
    if not p:
        stored   = load_settings()
        if not u:
            u = stored.get('traefik_api_user', '')
        p = stored.get('traefik_api_password', '')
    auth = (u, p) if u and p else None
    logger.info(f"Connection test to {url!r} by {request.remote_addr}")
    try:
        resp = requests.get(f"{url}/api/version", timeout=4, auth=auth, verify=_traefik_verify())
        if resp.status_code == 200:
            info = resp.json()
            return jsonify({'ok': True, 'version': info.get('Version', '?')})
        if resp.status_code in (401, 403):
            return jsonify({'ok': False, 'error': f'HTTP {resp.status_code} - check the API username and password'})
        return jsonify({'ok': False, 'error': f'HTTP {resp.status_code} from {url}/api/version'})
    except requests.exceptions.SSLError as e:
        return jsonify({'ok': False, 'error': f'TLS verification failed - the API certificate is not trusted. Mount your CA into /etc/ssl/certs/ca-certificates.crt or set TRAEFIK_INSECURE_SKIP_VERIFY=true. ({str(e)[:120]})'})
    except requests.exceptions.Timeout:
        return jsonify({'ok': False, 'error': 'Connection timed out - the API URL may be unreachable from the container'})
    except requests.exceptions.ConnectionError as e:
        return jsonify({'ok': False, 'error': f'Connection error - check the URL and network. ({str(e)[:120]})'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:160]})


@app.route('/api/settings/tabs', methods=['POST'])
@csrf_protect
@login_required
def api_save_tabs():
    try:
        data     = request.get_json() or {}
        existing = load_settings()
        vt       = existing['visible_tabs'].copy()
        for t in OPTIONAL_TABS:
            if t in data:
                vt[t] = bool(data[t])
        save_settings(
            domains=existing['domains'],
            cert_resolver=existing['cert_resolver'],
            traefik_api_url=existing['traefik_api_url'],
            auth_enabled=existing['auth_enabled'],
            password_hash=existing['password_hash'],
            visible_tabs=vt,
        )
        logger.info(f"Tab visibility updated by {request.remote_addr}: {vt}")
        return jsonify({'success': True, 'visible_tabs': vt})
    except Exception as e:
        logger.exception("Tab settings save error")
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/ui', methods=['GET', 'POST'])
@csrf_protect
@login_required
def api_ui_prefs():
    """Display preferences, stored server-side so they follow the user.

    These are cosmetic - which nav buttons and stat cards are shown, and whether
    each tab renders as cards or a list. Unknown keys are dropped rather than
    stored, so this endpoint cannot be used to write arbitrary data into
    manager.yml.
    """
    existing = load_settings()
    if request.method == 'GET':
        return jsonify({'ok': True, 'ui_prefs': existing.get('ui_prefs', {})})
    data = request.get_json(silent=True) or {}
    incoming = data.get('ui_prefs', data)
    if not isinstance(incoming, dict):
        return jsonify({'ok': False, 'message': 'ui_prefs must be an object'}), 400
    merged = dict(existing.get('ui_prefs', {}))
    merged.update(_settings.sanitize_ui_prefs(incoming))
    save_settings(
        domains=existing['domains'],
        cert_resolver=existing['cert_resolver'],
        traefik_api_url=existing['traefik_api_url'],
        auth_enabled=existing['auth_enabled'],
        password_hash=existing['password_hash'],
        visible_tabs=existing['visible_tabs'],
        ui_prefs=merged,
    )
    return jsonify({'ok': True, 'ui_prefs': merged})


@app.route('/api/settings/theme', methods=['POST'])
@csrf_protect
@login_required
def api_save_theme():
    try:
        data  = request.get_json(silent=True) or {}
        theme = str(data.get('default_theme', '')).strip().lower()
        if theme not in ('dark', 'light', 'system'):
            return jsonify({'success': False, 'error': 'Invalid theme'}), 400
        existing = load_settings()
        save_settings(
            domains=existing['domains'],
            cert_resolver=existing['cert_resolver'],
            traefik_api_url=existing['traefik_api_url'],
            auth_enabled=existing['auth_enabled'],
            password_hash=existing['password_hash'],
            visible_tabs=existing['visible_tabs'],
            default_theme=theme,
        )
        return jsonify({'success': True, 'default_theme': theme})
    except Exception:
        logger.exception("Theme save error")
        return jsonify({'success': False, 'error': 'Save failed'}), 500




@app.route('/api/settings/geoip', methods=['POST'])
@csrf_protect
@login_required
def api_save_geoip():
    try:
        data     = request.get_json(silent=True) or {}
        existing = load_settings()
        enabled  = bool(data['geoip_enabled']) if 'geoip_enabled' in data else existing.get('geoip_enabled', False)
        db_path  = str(data.get('geoip_db_path', existing.get('geoip_db_path', ''))).strip()
        save_settings(
            domains=existing['domains'],
            cert_resolver=existing['cert_resolver'],
            traefik_api_url=existing['traefik_api_url'],
            auth_enabled=existing['auth_enabled'],
            password_hash=existing['password_hash'],
            visible_tabs=existing['visible_tabs'],
            geoip_enabled=enabled,
            geoip_db_path=db_path,
        )
        return jsonify({'success': True, 'status': _geoip_status()})
    except Exception:
        logger.exception("GeoIP settings save error")
        return jsonify({'success': False, 'error': 'Save failed'}), 500



_CGNAT_NETWORK = ipaddress.ip_network('100.64.0.0/10')

def _classify_ip(ip: str) -> str:
    try:
        addr = ipaddress.ip_address((ip or '').strip())
    except ValueError:
        return 'unknown'
    if addr.is_loopback:
        return 'loopback'
    if addr.is_link_local:
        return 'link-local'
    if addr.version == 4 and addr in _CGNAT_NETWORK:
        return 'cgnat'
    if addr.is_private:
        return 'private'
    return 'public'


@app.route('/api/diagnostics/client-ip')
@login_required
def api_client_ip_diagnostic():
    orig        = request.environ.get('werkzeug.proxy_fix.orig') or {}
    socket_peer = orig.get('REMOTE_ADDR', '') or ''
    headers     = {
        'X-Forwarded-For':   request.headers.get('X-Forwarded-For', ''),
        'X-Real-IP':         request.headers.get('X-Real-IP', ''),
        'CF-Connecting-IP':  request.headers.get('CF-Connecting-IP', ''),
        'X-Forwarded-Proto': request.headers.get('X-Forwarded-Proto', ''),
        'X-Forwarded-Host':  request.headers.get('X-Forwarded-Host', ''),
    }
    xff_chain = [p.strip() for p in headers['X-Forwarded-For'].split(',') if p.strip()]
    effective = request.remote_addr or ''
    seen      = [ip for ip in [effective, socket_peer, *xff_chain] if ip]
    classes   = {ip: _classify_ip(ip) for ip in seen}
    return jsonify({
        'effective_ip':        effective,
        'effective_class':     _classify_ip(effective),
        'socket_peer':         socket_peer,
        'socket_peer_class':   _classify_ip(socket_peer),
        'headers':             headers,
        'forwarded_for_chain': xff_chain,
        'proxy_hops':          PROXY_FIX_HOPS,
        'classes':             classes,
    })


@app.route('/api/settings/backup-retention', methods=['POST'])
@csrf_protect
@login_required
def api_save_backup_retention():
    try:
        data     = request.get_json() or {}
        keep     = max(0, int(data.get('backup_keep_count', 0)))
        existing = load_settings()
        save_settings(
            domains=existing['domains'],
            cert_resolver=existing['cert_resolver'],
            traefik_api_url=existing['traefik_api_url'],
            auth_enabled=existing['auth_enabled'],
            password_hash=existing['password_hash'],
            visible_tabs=existing['visible_tabs'],
            backup_keep_count=keep,
        )
        return jsonify({'success': True, 'backup_keep_count': keep})
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid keep count'}), 400
    except Exception as e:
        logger.exception("Backup retention save error")
        return jsonify({'error': str(e)}), 500



@app.route('/api/settings/self-route', methods=['GET'])
@login_required
def api_get_self_route():
    settings = load_settings()
    sr = settings.get('self_route', {'domain': '', 'service_url': ''})
    default_ep = _best_entrypoint()
    if not sr.get('domain'):
        hostname = request.args.get('hostname', '').strip().lower()
        if hostname:
            found = _find_existing_self_route(hostname)
            if found:
                return jsonify({**found, 'default_entry_point': default_ep})
    return jsonify({**sr, 'default_entry_point': default_ep})

@app.route('/api/settings/self-route', methods=['POST'])
@csrf_protect
@login_required
def api_save_self_route():
    data = request.get_json(silent=True) or {}
    domain      = str(data.get('domain', '')).strip()
    service_url = str(data.get('service_url', '')).strip() or 'http://traefik-manager:5000'
    router_name = str(data.get('router_name', 'traefik-manager')).strip() or 'traefik-manager'
    entry_point = str(data.get('entry_point', '')).strip() or _best_entrypoint()
    settings = load_settings()
    if domain:
        _write_self_route(domain, service_url, settings.get('cert_resolver', 'cloudflare'), router_name, entry_point)
        sr = {'domain': domain, 'service_url': service_url, 'router_name': router_name, 'entry_point': entry_point}
    else:
        _delete_self_route()
        sr = {'domain': '', 'service_url': ''}
    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
        self_route=sr,
    )
    return jsonify({'ok': True})




def _file_template_map(path):
    if path and os.path.exists(path):
        with open(path, 'r') as f:
            _, mapping = _sanitize_go_templates(f.read())
        return mapping
    return {}












def _parse_backends_json(raw):
    import json as _json
    if not raw:
        return None
    try:
        data = _json.loads(raw)
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _clean_priority(value):
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _clean_duration(value):
    v = str(value or '').strip()
    if not v:
        return ''
    if v.isdigit():
        return v + 's'
    return v if re.match(r'^\d+(ms|s|m|h)$', v) else ''


def _backend_servers(rows, key, scheme_default='http'):
    servers = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        host = str(row.get('host') or '').strip()
        if not host:
            continue
        port = str(row.get('port') or '').strip()
        if key == 'url':
            if host.startswith('http://') or host.startswith('https://'):
                servers.append({'url': host})
            else:
                scheme = str(row.get('scheme') or scheme_default).strip() or scheme_default
                servers.append({'url': f"{scheme}://{host}:{port}" if port else f"{scheme}://{host}"})
        else:
            servers.append({key: f"{host}:{port}" if port else host})
    return servers


def _sticky_block(sticky):
    if not isinstance(sticky, dict) or not sticky.get('enabled'):
        return None
    cookie = {}
    name = str(sticky.get('cookieName') or '').strip()
    if name:
        cookie['name'] = name
    if sticky.get('secure'):
        cookie['secure'] = True
    if sticky.get('httpOnly'):
        cookie['httpOnly'] = True
    return {'cookie': cookie}


def _healthcheck_block(hc):
    if not isinstance(hc, dict) or not hc.get('enabled'):
        return None
    path = str(hc.get('path') or '').strip()
    if not path:
        return None
    block = {'path': path}
    for field in ('interval', 'timeout'):
        val = _clean_duration(hc.get(field))
        if val:
            block[field] = val
    return block


def _streaming_forwarding_timeouts() -> dict:
    return {'dialTimeout': '30s', 'responseHeaderTimeout': '0s', 'idleConnTimeout': '90s'}














def _headers_toggles_from_form(form) -> dict:
    perms = {}
    for feat in HEADERS_PRESET_FEATURES:
        val = form.get(f'hp_perm_{feat}', '')
        perms[feat] = val if val in ('self', 'all', 'block') else 'block'
    return {
        'perms': perms,
        'hsts': form.get('hp_hsts') == 'true',
        'nosniff': form.get('hp_nosniff') == 'true',
        'frameDeny': form.get('hp_frameDeny') == 'true',
        'referrer': (form.get('hp_referrer') or '').strip(),
    }























def _service_shared(config: dict, svc_name: str, exclude_router: str) -> bool:
    target = _svc_key(svc_name)
    for sec in ('http', 'tcp', 'udp'):
        routers = (config.get(sec) or {}).get('routers') or {}
        for rn, rd in routers.items():
            if rn == exclude_router or not isinstance(rd, dict):
                continue
            if _svc_key(rd.get('service', '')) == target:
                return True
    return False


def _toggle_route(route_id: str, enable: bool):
    settings = load_settings()
    disabled = settings.get('disabled_routes', {})
    rname = route_id.split('::', 1)[1] if '::' in route_id else route_id

    if enable:
        if route_id not in disabled:
            return
        saved       = disabled.pop(route_id)
        proto       = saved.get('protocol', 'http')
        router      = saved.get('router', {})
        svc_name    = _svc_key(router.get('service', rname))
        svc         = saved.get('service', {})
        cf          = saved.get('configFile', '')
        svc_cf      = saved.get('serviceConfigFile', cf)
        def _resolve_or_fallback(f):
            p = _resolve_config_path(f)
            if not p and f:
                safe = f if f.endswith(('.yml', '.yaml')) else f + '.yml'
                candidate = os.path.join(os.path.dirname(env.CONFIG_PATH) or '.', safe)
                p = candidate if _is_safe_path(candidate) else env.CONFIG_PATH
            return p or env.CONFIG_PATH
        target_path = _resolve_or_fallback(cf)
        config      = load_config(target_path)
        config.setdefault(proto, {}).setdefault('routers', {})[rname] = router
        if svc_cf == cf or not svc_cf:
            config.setdefault(proto, {}).setdefault('services', {})[svc_name] = svc
            create_backup(target_path)
            save_config(_strip_empty_sections(config), target_path)
        else:
            create_backup(target_path)
            save_config(_strip_empty_sections(config), target_path)
            svc_path   = _resolve_or_fallback(svc_cf)
            svc_config = load_config(svc_path)
            svc_config.setdefault(proto, {}).setdefault('services', {})[svc_name] = svc
            create_backup(svc_path)
            save_config(_strip_empty_sections(svc_config), svc_path)
    else:
        proto        = None
        router       = None
        svc_name     = None
        svc          = None
        target_path  = None
        svc_path     = None
        svc_config   = None
        cf_prefix   = route_id.split('::', 1)[0] if '::' in route_id else ''
        _pref_path  = _resolve_config_path(cf_prefix) if cf_prefix else None
        search_paths = [_pref_path] if _pref_path else env.CONFIG_PATHS
        for p in search_paths:
            config = load_config(p)
            for prot in ('http', 'tcp', 'udp'):
                routers = config.get(prot, {}).get('routers', {})
                if rname in routers:
                    proto       = prot
                    router      = dict(routers.pop(rname))
                    svc_name    = _svc_key(router.get('service', rname))
                    target_path = p
                    svc_config  = config
                    break
            if proto:
                break
        if proto is None:
            return
        if _service_shared(svc_config, svc_name, rname):
            svc = dict(svc_config.get(proto, {}).get('services', {}).get(svc_name, {}))
        else:
            svc = dict(svc_config.get(proto, {}).get('services', {}).pop(svc_name, {}))
        if not svc:
            for p in env.CONFIG_PATHS:
                if p == target_path:
                    continue
                other = load_config(p)
                if svc_name in other.get(proto, {}).get('services', {}):
                    svc      = dict(other[proto]['services'].pop(svc_name))
                    svc_path = p
                    svc      = _restore_go_templates(svc, _file_template_map(p))
                    other_stripped = _strip_empty_sections(other)
                    create_backup(p)
                    save_config(other_stripped, p)
                    break
        _target_map = _file_template_map(target_path)
        router = _restore_go_templates(router, _target_map)
        if svc_path is None:
            svc = _restore_go_templates(svc, _target_map)
        cf = os.path.basename(target_path) if (env.MULTI_CONFIG or ACTIVE_CONFIG_DIR) else ''
        svc_cf = os.path.basename(svc_path) if svc_path and (env.MULTI_CONFIG or ACTIVE_CONFIG_DIR) else cf
        disabled[route_id] = {'protocol': proto, 'router': router, 'service': svc, 'configFile': cf, 'serviceConfigFile': svc_cf}
        create_backup(target_path)
        save_config(_strip_empty_sections(svc_config), target_path)

    save_settings(
        domains=settings['domains'],
        cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'],
        auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'],
        visible_tabs=settings['visible_tabs'],
        disabled_routes=disabled,
    )


@app.route('/api/routes')
@login_required
def api_routes():
    apps, middlewares = _build_all_apps(include_external=False)
    apps = [a for a in apps if not (a.get('service_name') or '').endswith('@internal')]
    return jsonify({'apps': apps, 'middlewares': middlewares, 'configErrors': _get_config_parse_errors()})


@app.route('/api/routes/all')
@login_required
def api_routes_all():
    apps, middlewares = _build_all_apps(include_external=True, include_internal=True)
    return jsonify({'apps': apps, 'middlewares': middlewares})


@app.route('/api/configs')
@login_required
def api_configs():
    return jsonify({
        'files': [{'label': os.path.basename(p), 'path': p} for p in env.CONFIG_PATHS],
        'configDirSet': bool(ACTIVE_CONFIG_DIR),
    })


def _read_groups_config():
    if not os.path.exists(GROUPS_CONFIG_FILE):
        return {'custom_groups': [], 'route_overrides': {}}
    try:
        _y = SafeYAML(typ='safe')
        with open(GROUPS_CONFIG_FILE, 'r') as f:
            data = _y.load(f)
        if not data:
            return {'custom_groups': [], 'route_overrides': {}}
        return {
            'custom_groups':   list(data.get('custom_groups', []) or []),
            'route_overrides': dict(data.get('route_overrides', {}) or {}),
        }
    except Exception:
        logger.exception("Failed to read dashboard config")
        return {'custom_groups': [], 'route_overrides': {}}

def _write_groups_config(data):
    _y = SafeYAML(typ='safe')
    with open(GROUPS_CONFIG_FILE, 'w') as f:
        _y.dump({
            'custom_groups':   list(data.get('custom_groups', []) or []),
            'route_overrides': dict(data.get('route_overrides', {}) or {}),
        }, f)

@app.route('/api/dashboard/config', methods=['GET'])
@login_required
def dashboard_config_get():
    cfg = _read_groups_config()
    sr  = load_settings().get('self_route', {})
    cfg['tm_route_name'] = sr.get('router_name', 'traefik-manager') or 'traefik-manager'
    return jsonify(cfg)

@app.route('/api/dashboard/config', methods=['POST'])
@login_required
@csrf_protect
def dashboard_config_post():
    data = request.get_json() or {}
    _write_groups_config(data)
    return jsonify({'ok': True})

@app.route('/api/dashboard/icon/<slug>')
@login_required
def dashboard_icon(slug):
    slug = re.sub(r'[^a-z0-9-]', '', slug.lower())
    if not slug:
        return ('', 404)
    cache_path = os.path.join(GROUPS_CACHE_DIR, slug + '.png')
    miss_path  = os.path.join(GROUPS_CACHE_DIR, slug + '.404')
    if os.path.exists(cache_path):
        return send_file(cache_path, mimetype='image/png', max_age=86400, conditional=True)
    if os.path.exists(miss_path):
        return ('', 404)
    try:
        r = requests.get(f'https://cdn.jsdelivr.net/gh/selfhst/icons/png/{slug}.png', timeout=2)
        if r.status_code == 200 and 'image' in r.headers.get('content-type', ''):
            with open(cache_path, 'wb') as wf:
                wf.write(r.content)
            return send_file(cache_path, mimetype='image/png', max_age=86400, conditional=True)
        open(miss_path, 'w').close()
    except Exception:
        pass
    return ('', 404)


def _toggle_route_agent(agent: dict, agent_id: str, route_id: str, enable: bool):
    settings = load_settings()
    disabled = dict(settings.get('disabled_routes', {}))
    rname    = route_id.split('::', 1)[1] if '::' in route_id else route_id
    store_key = f"agent_{agent_id}::{route_id}"
    if enable:
        if store_key not in disabled:
            return
        saved    = disabled.pop(store_key)
        proto    = saved.get('protocol', 'http')
        router   = saved.get('router', {})
        svc_name = _svc_key(router.get('service', rname))
        svc      = saved.get('service', {})
        cf       = saved.get('configFile', 'dynamic.yml')
        all_cfgs = _agent_load_configs(agent)
        config   = all_cfgs.get(cf, {})
        config.setdefault(proto, {}).setdefault('routers', {})[rname] = router
        if svc:
            config.setdefault(proto, {}).setdefault('services', {})[svc_name] = svc
        _agent_write_config(agent, cf, config)
    else:
        all_cfgs = _agent_load_configs(agent)
        cf_prefix = route_id.split('::', 1)[0] if '::' in route_id else ''
        cfg_items = [(cf_prefix, all_cfgs[cf_prefix])] if cf_prefix in all_cfgs else list(all_cfgs.items())
        for fname, config in cfg_items:
            for prot in ('http', 'tcp', 'udp'):
                routers = config.get(prot, {}).get('routers', {})
                if rname in routers:
                    router   = dict(routers.pop(rname))
                    svc_name = _svc_key(router.get('service', rname))
                    if _service_shared(config, svc_name, rname):
                        svc = dict(config.get(prot, {}).get('services', {}).get(svc_name, {}))
                    else:
                        svc = dict(config.get(prot, {}).get('services', {}).pop(svc_name, {}))
                    disabled[store_key] = {'protocol': prot, 'router': router, 'service': svc, 'configFile': fname}
                    _agent_write_config(agent, fname, config)
                    break
            else:
                continue
            break
    save_settings(
        domains=settings['domains'], cert_resolver=settings['cert_resolver'],
        traefik_api_url=settings['traefik_api_url'], auth_enabled=settings['auth_enabled'],
        password_hash=settings['password_hash'], visible_tabs=settings['visible_tabs'],
        disabled_routes=disabled,
    )


@app.route('/api/routes/<path:route_id>/toggle', methods=['POST'])
@csrf_protect
@login_required
def api_toggle_route(route_id):
    body     = request.get_json(force=True, silent=True) or {}
    enable   = body.get('enable', True)
    agent_id = body.get('agent_id', '').strip()
    agent    = _agent_by_id(agent_id) if agent_id else None
    try:
        if agent:
            _toggle_route_agent(agent, agent_id, route_id, bool(enable))
            threading.Thread(target=lambda: _git_push_agent_if_enabled(agent, 'route toggle'), daemon=True).start()
        else:
            _toggle_route(route_id, bool(enable))
            threading.Thread(target=lambda: _git_push_if_enabled('route toggle'), daemon=True).start()
        return jsonify({'ok': True})
    except Exception as e:
        logger.error(f"Toggle route error: {e}")
        return jsonify({'ok': False, 'message': str(e)}), 500


@app.route('/api/routes/<path:route_id>/raw', methods=['GET'])
@login_required
def api_route_raw_get(route_id):
    rname = route_id.split('::', 1)[1] if '::' in route_id else route_id
    cf    = route_id.split('::', 1)[0] if '::' in route_id else ''

    target_path   = _resolve_config_path(cf) if cf else None
    paths_to_scan = [target_path] if target_path else env.CONFIG_PATHS

    for p in paths_to_scan:
        config = load_config(p)
        for proto in ('http', 'tcp', 'udp'):
            routers = config.get(proto, {}).get('routers', {})
            if rname in routers:
                router   = routers[rname]
                svc_name = router.get('service', rname)
                svc_key  = _svc_key(svc_name)
                svc      = config.get(proto, {}).get('services', {}).get(svc_key)
                out      = {proto: {'routers': {rname: dict(router)}}}
                if svc is not None:
                    out[proto]['services'] = {svc_name: dict(svc)}
                stream = StringIO()
                yaml.dump(out, stream)
                raw = stream.getvalue()
                with open(p, 'r') as f:
                    _, template_map = _sanitize_go_templates(f.read())
                for placeholder, original in template_map.items():
                    raw = raw.replace(placeholder, original)
                return jsonify({'raw': raw, 'configFile': os.path.basename(p), 'proto': proto})

    return jsonify({'error': 'Route not found'}), 404


@app.route('/api/routes/<path:route_id>/raw', methods=['POST'])
@csrf_protect
@login_required
def api_route_raw_save(route_id):
    body    = request.get_json(force=True, silent=True) or {}
    content = body.get('content', '')
    if not content.strip():
        return jsonify({'ok': False, 'error': 'No content'}), 400

    rname = route_id.split('::', 1)[1] if '::' in route_id else route_id
    cf    = route_id.split('::', 1)[0] if '::' in route_id else ''

    user_map     = {}
    user_counter = [0]
    def _replace_user(m):
        key = f'__TM_USER_{user_counter[0]}__'
        user_map[key] = m.group(0)
        user_counter[0] += 1
        return key
    sanitized_user = re.sub(r'\{\{[^}]*\}\}', _replace_user, content)

    try:
        new_data = yaml.load(sanitized_user)
        if not isinstance(new_data, dict):
            raise ValueError("Expected a YAML mapping")
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Invalid YAML: {e}'}), 400

    target_path = _resolve_config_path(cf) if cf else None
    if not target_path:
        for p in env.CONFIG_PATHS:
            cfg = load_config(p)
            for proto in ('http', 'tcp', 'udp'):
                if rname in cfg.get(proto, {}).get('routers', {}):
                    target_path = p
                    break
            if target_path:
                break
    if not target_path:
        return jsonify({'ok': False, 'error': 'Route not found'}), 404

    config = load_config(target_path)

    for proto in ('http', 'tcp', 'udp'):
        proto_cfg  = config.get(proto, {})
        old_router = proto_cfg.get('routers', {}).pop(rname, None)
        if old_router:
            old_svc = _svc_key(old_router.get('service', rname))
            proto_cfg.get('services', {}).pop(old_svc, None)

    for proto in ('http', 'tcp', 'udp'):
        new_proto = new_data.get(proto, {})
        if not new_proto:
            continue
        section = config.setdefault(proto, {})
        new_routers  = new_proto.get('routers', {})
        new_services = new_proto.get('services', {})
        if new_routers:
            section.setdefault('routers', {}).update(new_routers)
        if new_services:
            section.setdefault('services', {}).update(new_services)

    try:
        create_backup(target_path)
        file_map = {}
        if os.path.exists(target_path):
            with open(target_path, 'r') as f:
                _, file_map = _sanitize_go_templates(f.read())
        combined_map = {**file_map, **user_map}
        stream = StringIO()
        yaml.dump(_strip_empty_sections(config), stream)
        yaml_content = stream.getvalue()
        for placeholder, original in combined_map.items():
            yaml_content = yaml_content.replace(placeholder, original)
        tmp = f"{target_path}.tmp.{os.getpid()}.{threading.get_ident()}"
        try:
            with open(tmp, 'w') as f:
                f.write(yaml_content)
            shutil.copyfile(tmp, target_path)
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass
        logger.info(f"Route '{rname}' raw config saved: {target_path}")
        add_notification('success', f"Route '{rname}' updated")
        threading.Thread(target=lambda: _git_push_if_enabled('route raw save'), daemon=True).start()
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception("Route raw save error")
        return jsonify({'ok': False, 'error': str(e)}), 500


def _static_cert_resolvers():
    path = _get_static_config_path()
    if not path or not os.path.exists(path):
        return []
    try:
        with open(path, 'r') as f:
            data = _yaml_safe.load(f) or {}
        resolvers = data.get('certificatesResolvers') or {}
        if isinstance(resolvers, dict):
            return [str(k).strip() for k in resolvers if str(k).strip()]
    except Exception:
        logger.debug("Failed to read certificatesResolvers from static config", exc_info=True)
    return []

@app.route('/')
@login_required
def index():
    settings    = load_settings()
    apps, middlewares = _build_all_apps(include_external=False)
    apps = [a for a in apps if not (a.get('service_name') or '').endswith('@internal')]
    auth_on    = _auth_required()
    no_auth    = not _auth_required()
    login_time = session.get('login_time', '')
    config_paths_list = [{'label': os.path.basename(p), 'path': p} for p in env.CONFIG_PATHS]
    cert_resolvers    = [r.strip() for r in settings['cert_resolver'].split(',') if r.strip()]
    for r in _static_cert_resolvers():
        if r not in cert_resolvers:
            cert_resolvers.append(r)

    return render_template('index.html', apps=apps, domains=settings['domains'],
                           middlewares=middlewares, settings=settings,
                           auth_enabled=auth_on, no_auth=no_auth, login_time=login_time,
                           multi_config=env.MULTI_CONFIG,
                           config_paths_list=config_paths_list,
                           config_dir_set=bool(ACTIVE_CONFIG_DIR),
                           cert_resolvers=cert_resolvers,
                           crowdsec_enabled=bool(_cs_lapi_url() and _cs_api_key()),
                           ui_prefs=settings.get('ui_prefs', {}))


def _is_fetch():
    return request.headers.get('X-Requested-With') == 'fetch'


@app.route('/save', methods=['POST'])
@csrf_protect
@login_required
def save_entry():
    fetch = _is_fetch()
    try:
        settings       = load_settings()
        svc_name       = request.form.get('serviceName', '').strip()
        subdomain      = request.form.get('subdomain', '').strip()
        domain         = request.form.get('domain', settings['domains'][0]).strip()
        middlewares_in = request.form.get('middlewares', '').strip()
        protocol       = request.form.get('protocol', 'http').strip().lower()
        is_edit        = request.form.get('isEdit') == 'true'
        original_id    = request.form.get('originalId', '')
        tcp_rule       = request.form.get('tcpRule', '').strip()
        http_rule      = request.form.get('httpRule', '').strip()
        scheme         = request.form.get('scheme', 'http').strip().lower()
        pass_host      = request.form.get('passHostHeader') == 'true'
        _all_eps       = request.form.getlist('entryPoints')
        http_eps       = [ep.strip() for ep in (_all_eps[0] if _all_eps else 'https').split(',') if ep.strip()] or ['https']
        tcp_eps        = [ep.strip() for ep in (_all_eps[1] if len(_all_eps) > 1 else '').split(',') if ep.strip()]
        _all_ips       = request.form.getlist('targetIp')
        _all_ports     = request.form.getlist('targetPort')
        if protocol == 'tcp':
            target_ip   = (_all_ips[1]   if len(_all_ips)   > 1 else '').strip()
            target_port = (_all_ports[1] if len(_all_ports) > 1 else '').strip()
        elif protocol == 'udp':
            target_ip   = (_all_ips[2]   if len(_all_ips)   > 2 else '').strip()
            target_port = (_all_ports[2] if len(_all_ports) > 2 else '').strip()
        else:
            target_ip   = (_all_ips[0]   if _all_ips   else '').strip()
            target_port = (_all_ports[0] if _all_ports else '').strip()
        resolvers      = [r.strip() for r in settings['cert_resolver'].split(',') if r.strip()]
        _all_resolvers    = request.form.getlist('certResolver')
        cert_resolver_raw = (_all_resolvers[0] if _all_resolvers else '').strip()
        no_tls            = cert_resolver_raw == '__disabled__'
        cert_resolver     = '' if (cert_resolver_raw in ('__none__', 'none', '__disabled__')) else (cert_resolver_raw or (resolvers[0] if resolvers else ''))
        use_tls_tcp       = request.form.get('useTls') == 'true'
        tls_passthrough   = request.form.get('tlsPassthrough') == 'true'
        mws_tcp_raw       = request.form.get('middlewaresTcp')
        tcp_cert_raw      = (_all_resolvers[1] if len(_all_resolvers) > 1 else '').strip()
        tcp_cert_resolver = '' if (tcp_cert_raw in ('__none__', 'none')) else (tcp_cert_raw or (resolvers[0] if resolvers else ''))
        config_file_raw = request.form.get('configFile', '').strip()
        agent_id        = request.form.get('agent_id', '').strip()
        agent           = _agent_by_id(agent_id) if agent_id else None
        target_path     = None if agent else (_resolve_config_path(config_file_raw) or env.CONFIG_PATH)
        cfg_filename    = config_file_raw or 'dynamic.yml'

        if not svc_name:
            if fetch:
                return jsonify({'ok': False, 'message': 'Service name is required'}), 400
            flash("Service name is required", "error")
            return redirect(url_for('index'))
        if protocol not in ('http', 'tcp', 'udp'):
            if fetch:
                return jsonify({'ok': False, 'message': 'Invalid protocol'}), 400
            flash("Invalid protocol", "error")
            return redirect(url_for('index'))

        _backends_field = {'http': 'backendsJsonHttp', 'tcp': 'backendsJsonTcp',
                           'udp': 'backendsJsonUdp'}[protocol]
        _has_backends_json = bool((_parse_backends_json(request.form.get(_backends_field)) or {}).get('servers'))
        if not target_ip and not _has_backends_json:
            _msg = (f"A backend host is required for {protocol.upper()} routes. "
                    f"Send targetIp (repeated per protocol, index "
                    f"{ {'http': 0, 'tcp': 1, 'udp': 2}[protocol] }) or {_backends_field}.")
            if fetch:
                return jsonify({'ok': False, 'message': _msg}), 400
            flash(_msg, "error")
            return redirect(url_for('index'))

        router_name  = svc_name
        service_name = f"{svc_name}-service"
        if agent:
            config = _agent_load_configs(agent).get(cfg_filename, {})
        else:
            create_backup(target_path)
            config = load_config(target_path)

        orig_parts = original_id.split('::', 1)
        plain_original_id = orig_parts[1] if len(orig_parts) > 1 else original_id
        orig_cfg_file = orig_parts[0] if len(orig_parts) > 1 else cfg_filename

        _ledger            = settings.get('managed_middlewares', {})
        _ledger_changed    = False
        hdr_name           = f"{router_name}-headers"
        hdr_ledger_key     = f"agent_{agent_id}::{hdr_name}" if agent else hdr_name
        hdr_preset_present = protocol == 'http' and request.form.get('headersPresetPresent') == 'true'
        hdr_preset_on      = hdr_preset_present and request.form.get('headersPresetEnabled') == 'true'
        hdr_preset_custom  = request.form.get('headersPresetCustom') == 'true'
        stream_preset_present = protocol == 'http' and request.form.get('streamingPresetPresent') == 'true'
        stream_preset_on      = stream_preset_present and request.form.get('streamingPresetEnabled') == 'true'
        if hdr_preset_on:
            _existing_hdr = config.get('http', {}).get('middlewares', {}).get(hdr_name)
            _hdr_foreign  = _existing_hdr is not None and (
                hdr_ledger_key not in _ledger or (is_edit and orig_cfg_file != cfg_filename))
            if _hdr_foreign:
                _msg = f"A middleware named '{hdr_name}' already exists and wasn't created by the route presets. Rename or remove it first, then re-save."
                if fetch:
                    return jsonify({'ok': False, 'message': _msg}), 409
                flash(_msg, "error")
                return redirect(url_for('index'))

        _prev_tcp_mws = None
        if is_edit and plain_original_id:
            _prev_src = config
            if orig_cfg_file != cfg_filename:
                if agent:
                    _prev_src = _agent_load_configs(agent).get(orig_cfg_file, {})
                else:
                    _prev_path = _resolve_config_path(orig_cfg_file)
                    _prev_src = load_config(_prev_path) if _prev_path else {}
            _prev_tcp_mws = _prev_src.get('tcp', {}).get('routers', {}).get(plain_original_id, {}).get('middlewares')
            for sec in ('http', 'tcp', 'udp'):
                prev_router = _prev_src.get(sec, {}).get('routers', {}).get(plain_original_id)
                if not isinstance(prev_router, dict):
                    continue
                prev_svc = (prev_router.get('service') or '').split('@')[0].strip()
                if prev_svc and prev_svc in _prev_src.get(sec, {}).get('services', {}):
                    service_name = prev_svc
                break

        if is_edit and plain_original_id and orig_cfg_file != cfg_filename:
            if agent:
                old_all_cfgs = _agent_load_configs(agent)
                old_config = old_all_cfgs.get(orig_cfg_file, {})
            else:
                orig_target_path = _resolve_config_path(orig_cfg_file)
                old_config = load_config(orig_target_path) if orig_target_path else {}
            for sec in ('http', 'tcp', 'udp'):
                s = old_config.get(sec, {})
                old_routers = s.get('routers', {})
                old_svc = (old_routers.get(plain_original_id, {}).get('service') or '').strip()
                if plain_original_id in old_routers:
                    del old_routers[plain_original_id]
                if old_svc and 'services' in s and old_svc in s['services']:
                    del s['services'][old_svc]
            old_transport_name = f"{plain_original_id}-transport"
            http_sec = old_config.get('http', {})
            old_transports = http_sec.get('serversTransports', {})
            if old_transport_name in old_transports:
                del old_transports[old_transport_name]
                if not old_transports:
                    del http_sec['serversTransports']
            old_hdr_name = f"{plain_original_id}-headers"
            old_hdr_key  = f"agent_{agent_id}::{old_hdr_name}" if agent else old_hdr_name
            if hdr_preset_present and old_hdr_key in _ledger:
                old_hdr_mws = http_sec.get('middlewares', {})
                old_hdr_mws.pop(old_hdr_name, None)
                if not old_hdr_mws and 'middlewares' in http_sec:
                    del http_sec['middlewares']
                del _ledger[old_hdr_key]
                _ledger_changed = True
            if agent:
                _agent_write_config(agent, orig_cfg_file, old_config)
            elif orig_target_path:
                save_config(_strip_empty_sections(old_config), orig_target_path)

        if is_edit and plain_original_id:
            for sec in ('http', 'tcp', 'udp'):
                s = config.get(sec, {})
                old_routers = s.get('routers', {})
                old_svc = (old_routers.get(plain_original_id, {}).get('service') or '').strip()
                if plain_original_id != router_name and plain_original_id in old_routers:
                    del old_routers[plain_original_id]
                if old_svc and old_svc != service_name and 'services' in s and old_svc in s['services']:
                    del s['services'][old_svc]
            if hdr_preset_present and plain_original_id != router_name:
                rn_hdr_name = f"{plain_original_id}-headers"
                rn_hdr_key  = f"agent_{agent_id}::{rn_hdr_name}" if agent else rn_hdr_name
                if rn_hdr_key in _ledger:
                    rn_hdr_mws = config.get('http', {}).get('middlewares', {})
                    rn_hdr_mws.pop(rn_hdr_name, None)
                    if not rn_hdr_mws and 'http' in config and 'middlewares' in config['http']:
                        del config['http']['middlewares']
                    del _ledger[rn_hdr_key]
                    _ledger_changed = True

        if protocol == 'http':
            if http_rule:
                rule = http_rule
            else:
                selected_domains = request.form.getlist('domains') or [domain]
                if subdomain and '.' in subdomain:
                    rule = f"Host(`{subdomain}`)"
                elif subdomain:
                    hosts = [f"Host(`{subdomain}.{d}`)" for d in selected_domains]
                    rule  = " || ".join(hosts)
                else:
                    hosts = [f"Host(`{d}`)" for d in selected_domains]
                    rule  = " || ".join(hosts)
            if target_ip.startswith(('http://', 'https://')):
                target_url = target_ip
            else:
                target_url = f"{scheme}://{target_ip}:{target_port}" if target_port else f"{scheme}://{target_ip}"
            mws        = [m.strip() for m in middlewares_in.split(',')] if middlewares_in else []
            insecure   = request.form.get('insecureSkipVerify') == 'true'
            config.setdefault('http', {}).setdefault('routers', {})
            config['http'].setdefault('services', {})
            if hdr_preset_present:
                if hdr_preset_on or hdr_ledger_key in _ledger:
                    mws = [m for m in mws if m != hdr_name]
                if hdr_preset_on and not hdr_preset_custom:
                    config['http'].setdefault('middlewares', {})[hdr_name] = _build_headers_middleware(_headers_toggles_from_form(request.form))
                _hdr_present_now = config.get('http', {}).get('middlewares', {}).get(hdr_name) is not None
                if hdr_preset_on and _hdr_present_now:
                    mws.append(hdr_name)
                    if hdr_ledger_key not in _ledger:
                        _ledger[hdr_ledger_key] = {'kind': 'route-headers', 'route': router_name}
                        _ledger_changed = True
                elif hdr_ledger_key in _ledger:
                    _hdr_sec = config.get('http', {}).get('middlewares', {})
                    _hdr_sec.pop(hdr_name, None)
                    if not _hdr_sec and 'middlewares' in config['http']:
                        del config['http']['middlewares']
                    _ledger.pop(hdr_ledger_key, None)
                    _ledger_changed = True
            r = {'rule': rule, 'entryPoints': http_eps, 'service': service_name}
            if mws:
                r['middlewares'] = mws
            if not no_tls:
                tls_entry = {'certResolver': cert_resolver} if cert_resolver else {}
                tls_main  = request.form.get('tlsWildcardMain', '').strip()
                tls_sans  = [s.strip() for s in request.form.get('tlsWildcardSans', '').splitlines() if s.strip()]
                if tls_main:
                    domain_entry = {'main': tls_main}
                    if tls_sans:
                        domain_entry['sans'] = tls_sans
                    tls_entry['domains'] = [domain_entry]
                tls_opts_profile = request.form.get('tlsOptionsProfile', '').strip()
                if tls_opts_profile:
                    tls_entry['options'] = tls_opts_profile
                r['tls'] = tls_entry
            _be = _parse_backends_json(request.form.get('backendsJsonHttp'))
            _managed_backends = False
            if _be is not None:
                _servers = _backend_servers(_be.get('servers'), 'url', scheme)
                if _servers:
                    _managed_backends = True
                    lb = {'servers': _servers}
                else:
                    lb = {'servers': [{'url': target_url}]}
            else:
                lb = {'servers': [{'url': target_url}]}
            if not pass_host and not stream_preset_on:
                lb['passHostHeader'] = False
            if _managed_backends:
                _sticky = _sticky_block(_be.get('sticky'))
                if _sticky:
                    lb['sticky'] = _sticky
                _hc = _healthcheck_block(_be.get('healthCheck'))
                if _hc:
                    lb['healthCheck'] = _hc
                _prio = _clean_priority(_be.get('priority'))
                if _prio:
                    r['priority'] = _prio
            transport_name = f"{svc_name}-transport"
            existing_transports = config.get('http', {}).get('serversTransports', {})
            tp = existing_transports.get(transport_name)
            tp = tp if isinstance(tp, dict) else {}
            if insecure:
                tp['insecureSkipVerify'] = True
            else:
                tp.pop('insecureSkipVerify', None)
            if stream_preset_present:
                if stream_preset_on:
                    tp['forwardingTimeouts'] = _streaming_forwarding_timeouts()
                else:
                    tp.pop('forwardingTimeouts', None)
            if tp:
                config['http'].setdefault('serversTransports', {})[transport_name] = tp
                lb['serversTransport'] = transport_name
            elif transport_name in existing_transports:
                del existing_transports[transport_name]
                if not existing_transports and 'serversTransports' in config['http']:
                    del config['http']['serversTransports']
            _http_managed = ('rule', 'entryPoints', 'service', 'middlewares', 'tls', 'priority') \
                if _managed_backends else ('rule', 'entryPoints', 'service', 'middlewares', 'tls')
            _merge_router(config['http']['routers'], router_name, r, _http_managed)
            _merge_service(config['http']['services'], service_name, lb, 'url', transport_name,
                           managed_backends=_managed_backends)

        elif protocol == 'tcp':
            if tcp_rule:
                rule = tcp_rule
            elif subdomain:
                _sni = subdomain if '.' in subdomain else f"{subdomain}.{domain}"
                rule = f"HostSNI(`{_sni}`)"
            else:
                rule = "HostSNI(`*`)"
            config.setdefault('tcp', {}).setdefault('routers', {})
            config['tcp'].setdefault('services', {})
            router_entry = {'rule': rule, 'service': service_name}
            if tcp_eps:
                router_entry['entryPoints'] = tcp_eps
            if mws_tcp_raw is not None:
                tcp_mws = [m.strip() for m in mws_tcp_raw.split(',') if m.strip()]
                if tcp_mws:
                    router_entry['middlewares'] = tcp_mws
            elif _prev_tcp_mws:
                router_entry['middlewares'] = _prev_tcp_mws
            if tls_passthrough:
                router_entry['tls'] = {'passthrough': True}
            elif use_tls_tcp:
                router_entry['tls'] = {'certResolver': tcp_cert_resolver} if tcp_cert_resolver else {}
            _be_tcp = _parse_backends_json(request.form.get('backendsJsonTcp'))
            _tcp_managed = False
            _tcp_lb = {'servers': [{'address': f"{target_ip}:{target_port}"}]}
            if _be_tcp is not None:
                _tcp_servers = _backend_servers(_be_tcp.get('servers'), 'address')
                if _tcp_servers:
                    _tcp_managed = True
                    _tcp_lb = {'servers': _tcp_servers}
                    _tcp_prio = _clean_priority(_be_tcp.get('priority'))
                    if _tcp_prio:
                        router_entry['priority'] = _tcp_prio
            _tcp_keys = ('rule', 'entryPoints', 'service', 'middlewares', 'tls', 'priority') \
                if _tcp_managed else ('rule', 'entryPoints', 'service', 'middlewares', 'tls')
            _merge_router(config['tcp']['routers'], router_name, router_entry, _tcp_keys)
            _merge_service(config['tcp']['services'], service_name, _tcp_lb, 'address', '',
                           managed_backends=_tcp_managed)

        elif protocol == 'udp':
            udp_ep = request.form.get('udpEntryPoint', '').strip()
            config.setdefault('udp', {}).setdefault('routers', {})
            config['udp'].setdefault('services', {})
            _merge_router(config['udp']['routers'], router_name,
                          {'entryPoints': [udp_ep] if udp_ep else [], 'service': service_name},
                          ('entryPoints', 'service'))
            _be_udp = _parse_backends_json(request.form.get('backendsJsonUdp'))
            _udp_managed = False
            _udp_lb = {'servers': [{'address': f"{target_ip}:{target_port}"}]}
            if _be_udp is not None:
                _udp_servers = _backend_servers(_be_udp.get('servers'), 'address')
                if _udp_servers:
                    _udp_managed = True
                    _udp_lb = {'servers': _udp_servers}
            _merge_service(config['udp']['services'], service_name, _udp_lb, 'address', '',
                           managed_backends=_udp_managed)

        if _ledger_changed:
            save_settings(
                domains=settings['domains'],
                cert_resolver=settings['cert_resolver'],
                traefik_api_url=settings['traefik_api_url'],
                auth_enabled=settings['auth_enabled'],
                password_hash=settings['password_hash'],
                visible_tabs=settings['visible_tabs'],
                managed_middlewares=_ledger,
            )
        if agent:
            _agent_write_config(agent, cfg_filename, config)
            threading.Thread(target=lambda: _git_push_agent_if_enabled(agent, 'route save'), daemon=True).start()
        else:
            save_config(_strip_empty_sections(config), target_path)
            _register_config_path(target_path)
            threading.Thread(target=lambda: _git_push_if_enabled('route save'), daemon=True).start()
        if is_edit and original_id:
            disabled = settings.get('disabled_routes', {})
            dkey = f"agent_{agent_id}::{original_id}" if agent else original_id
            if dkey in disabled:
                disabled.pop(dkey)
                save_settings(disabled_routes=disabled)
        msg = f"Successfully saved {svc_name}"
        action = "updated" if is_edit else "created"
        add_notification('success', f"Route {svc_name} {action}")
        if fetch:
            return jsonify({'ok': True, 'message': msg})
        flash(msg, "success")
    except Exception:
        logger.exception("Error saving configuration")
        if fetch:
            return jsonify({'ok': False, 'message': 'Error saving configuration'}), 500
        flash("Error saving configuration", "error")
    return redirect(url_for('index'))


@app.route('/delete/<router_id>', methods=['POST'])
@csrf_protect
@login_required
def delete_entry(router_id):
    fetch = _is_fetch()
    try:
        settings        = load_settings()
        config_file_raw = request.form.get('configFile', '').strip()
        agent_id        = request.form.get('agent_id', '').strip()
        agent           = _agent_by_id(agent_id) if agent_id else None
        plain_id = router_id.split('::', 1)[1] if '::' in router_id else router_id
        deleted = False
        if agent:
            all_configs = _agent_load_configs(agent)
            for fname, config in all_configs.items():
                if config_file_raw and fname != config_file_raw:
                    continue
                for sec in ('http', 'tcp', 'udp'):
                    s = config.get(sec, {})
                    if plain_id in s.get('routers', {}):
                        svc = (s['routers'][plain_id].get('service') or '').strip()
                        del s['routers'][plain_id]
                        if (svc and 'services' in s and svc in s['services']
                                and not _service_shared(config, svc, plain_id)):
                            del s['services'][svc]
                        _agent_write_config(agent, fname, config)
                        deleted = True
                        break
                if deleted:
                    break
        else:
            if config_file_raw:
                search_paths = [_resolve_config_path(config_file_raw) or env.CONFIG_PATH]
            else:
                search_paths = env.CONFIG_PATHS
            for target_path in search_paths:
                config = load_config(target_path)
                for sec in ('http', 'tcp', 'udp'):
                    s = config.get(sec, {})
                    if plain_id in s.get('routers', {}):
                        svc = (s['routers'][plain_id].get('service') or '').strip()
                        del s['routers'][plain_id]
                        if (svc and 'services' in s and svc in s['services']
                                and not _service_shared(config, svc, plain_id)):
                            del s['services'][svc]
                        create_backup(target_path)
                        save_config(_strip_empty_sections(config), target_path)
                        deleted = True
                        break
                if deleted:
                    break
        if not deleted:
            disabled = settings.get('disabled_routes', {})
            if agent:
                agent_id = request.form.get('agent_id', '').strip()
                store_key = f"agent_{agent_id}::{router_id}"
                if store_key not in disabled:
                    cand = [k for k in disabled
                            if k.startswith(f"agent_{agent_id}::") and (k.split('::')[-1] == plain_id)]
                    store_key = cand[0] if cand else store_key
                if store_key in disabled:
                    disabled.pop(store_key)
                    save_settings(disabled_routes=disabled)
                    deleted = True
            elif plain_id in disabled:
                disabled.pop(plain_id)
                save_settings(disabled_routes=disabled)
                deleted = True
        if not deleted:
            if fetch:
                return jsonify({'ok': False, 'message': f'Route "{plain_id}" not found'}), 404
            flash(f'Route "{plain_id}" not found', "error")
            return redirect(url_for('index'))
        if agent:
            threading.Thread(target=lambda: _git_push_agent_if_enabled(agent, 'route delete'), daemon=True).start()
        else:
            threading.Thread(target=lambda: _git_push_if_enabled('route delete'), daemon=True).start()
        msg = f"Deleted {plain_id}"
        add_notification('warning', f"Route {plain_id} deleted")
        if fetch:
            return jsonify({'ok': True, 'message': msg})
        flash(msg, "success")
    except Exception:
        logger.exception("Delete error")
        if fetch:
            return jsonify({'ok': False, 'message': 'Error deleting'}), 500
        flash("Error deleting", "error")
    return redirect(url_for('index'))


@app.route('/save-middleware', methods=['POST'])
@csrf_protect
@login_required
def save_middleware():
    fetch = _is_fetch()
    try:
        mw_name         = request.form.get('middlewareName', '').strip()
        mw_content      = request.form.get('middlewareContent', '').strip()
        is_edit         = request.form.get('isMwEdit') == 'true'
        original_id     = request.form.get('originalMwId', '')
        mw_protocol     = request.form.get('mwProtocol', 'http').strip().lower()
        if mw_protocol not in ('http', 'tcp'):
            mw_protocol = 'http'
        original_proto  = request.form.get('originalMwProtocol', '').strip().lower()
        if original_proto not in ('http', 'tcp'):
            original_proto = mw_protocol
        config_file_raw = request.form.get('configFile', '').strip()
        agent_id        = request.form.get('agent_id', '').strip()
        agent           = _agent_by_id(agent_id) if agent_id else None
        cfg_filename    = config_file_raw or 'dynamic.yml'
        target_path     = None if agent else (_resolve_config_path(config_file_raw) or env.CONFIG_PATH)
        if not mw_name:
            if fetch:
                return jsonify({'ok': False, 'message': 'Middleware name is required'}), 400
            flash("Middleware name is required", "error")
            return redirect(url_for('index'))
        if not mw_content:
            if fetch:
                return jsonify({'ok': False, 'message': 'Middleware content cannot be empty'}), 400
            flash("Middleware content cannot be empty", "error")
            return redirect(url_for('index'))
        try:
            parsed_mw = SafeYAML(typ='safe').load(mw_content)
        except Exception as ye:
            msg = f'Invalid YAML: {ye}'
            if fetch:
                return jsonify({'ok': False, 'message': msg}), 400
            flash(msg, "error")
            return redirect(url_for('index'))
        if parsed_mw is None or not isinstance(parsed_mw, dict) or not parsed_mw:
            if fetch:
                return jsonify({'ok': False, 'message': 'Middleware content is empty or invalid'}), 400
            flash("Middleware content is empty or invalid", "error")
            return redirect(url_for('index'))
        if any(k in parsed_mw for k in ('http', 'tcp', 'udp')):
            msg = 'Paste only the middleware configuration body (e.g. ipAllowList: ...), not a full http:/tcp: config block'
            if fetch:
                return jsonify({'ok': False, 'message': msg}), 400
            flash(msg, "error")
            return redirect(url_for('index'))
        if mw_protocol == 'tcp' and not set(parsed_mw.keys()) <= {'ipAllowList', 'ipWhiteList', 'inFlightConn'}:
            msg = 'TCP middlewares support only ipAllowList and inFlightConn'
            if fetch:
                return jsonify({'ok': False, 'message': msg}), 400
            flash(msg, "error")
            return redirect(url_for('index'))
        if agent:
            config = _agent_load_configs(agent).get(cfg_filename, {})
        else:
            create_backup(target_path)
            config = load_config(target_path)
        config.setdefault(mw_protocol, {}).setdefault('middlewares', {})
        if is_edit and original_id and (original_id != mw_name or original_proto != mw_protocol):
            config.get(original_proto, {}).get('middlewares', {}).pop(original_id, None)
        config[mw_protocol]['middlewares'][mw_name] = parsed_mw
        if agent:
            _agent_write_config(agent, cfg_filename, config)
            threading.Thread(target=lambda: _git_push_agent_if_enabled(agent, 'middleware save'), daemon=True).start()
        else:
            save_config(_strip_empty_sections(config), target_path)
            _register_config_path(target_path)
            threading.Thread(target=lambda: _git_push_if_enabled('middleware save'), daemon=True).start()
        msg = f"Successfully saved middleware {mw_name}"
        action = "updated" if is_edit else "created"
        add_notification('success', f"Middleware {mw_name} {action}")
        if fetch:
            return jsonify({'ok': True, 'message': msg})
        flash(msg, "success")
    except Exception:
        logger.exception("Middleware save error")
        if fetch:
            return jsonify({'ok': False, 'message': 'Error saving middleware'}), 500
        flash("Error saving middleware", "error")
    return redirect(url_for('index'))


@app.route('/delete-middleware/<mw_name>', methods=['POST'])
@csrf_protect
@login_required
def delete_middleware(mw_name):
    fetch = _is_fetch()
    try:
        config_file_raw = request.form.get('configFile', '').strip()
        agent_id        = request.form.get('agent_id', '').strip()
        agent           = _agent_by_id(agent_id) if agent_id else None
        if agent:
            all_configs = _agent_load_configs(agent)
            for fname, config in all_configs.items():
                if config_file_raw and fname != config_file_raw:
                    continue
                found = False
                for section in ('http', 'tcp'):
                    mws = config.get(section, {}).get('middlewares', {})
                    if mw_name in mws:
                        mws.pop(mw_name, None)
                        found = True
                        break
                if found:
                    _agent_write_config(agent, fname, config)
                    break
        else:
            if config_file_raw:
                search_paths = [_resolve_config_path(config_file_raw) or env.CONFIG_PATH]
            else:
                search_paths = env.CONFIG_PATHS
            for target_path in search_paths:
                config = load_config(target_path)
                found = False
                for section in ('http', 'tcp'):
                    mws = config.get(section, {}).get('middlewares', {})
                    if mw_name in mws:
                        mws.pop(mw_name, None)
                        found = True
                        break
                if found:
                    create_backup(target_path)
                    save_config(_strip_empty_sections(config), target_path)
                    break
        if agent:
            threading.Thread(target=lambda: _git_push_agent_if_enabled(agent, 'middleware delete'), daemon=True).start()
        else:
            threading.Thread(target=lambda: _git_push_if_enabled('middleware delete'), daemon=True).start()
        msg = f"Deleted middleware {mw_name}"
        add_notification('warning', f"Middleware {mw_name} deleted")
        if fetch:
            return jsonify({'ok': True, 'message': msg})
        flash(msg, "success")
    except Exception:
        logger.exception("Middleware delete error")
        if fetch:
            return jsonify({'ok': False, 'message': 'Error deleting middleware'}), 500
        flash("Error deleting middleware", "error")
    return redirect(url_for('index'))


@app.route('/auth/oidc/login')
@limiter.limit("10 per minute")
def oidc_login():
    s = load_settings()
    if not s.get('oidc_enabled'):
        return redirect(url_for('login'))
    provider_url = s.get('oidc_provider_url', '').rstrip('/')
    if not provider_url:
        return redirect(url_for('login'))
    try:
        disc = requests.get(f"{provider_url}/.well-known/openid-configuration", timeout=5)
        disc.raise_for_status()
        cfg = disc.json()
    except Exception:
        logger.exception("OIDC discovery failed")
        flash("OIDC provider unavailable. Try again later.", "error")
        return redirect(url_for('login'))
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    session['oidc_state'] = state
    session['oidc_nonce'] = nonce
    redirect_uri = url_for('oidc_callback', _external=True)
    from urllib.parse import urlencode
    scopes = ['openid', 'email', 'profile']
    groups_claim = s.get('oidc_groups_claim', '').strip()
    if s.get('oidc_allowed_groups', '').strip() and groups_claim and groups_claim not in scopes:
        scopes.append(groups_claim)
    params = urlencode({
        'response_type': 'code',
        'client_id':     s.get('oidc_client_id', ''),
        'redirect_uri':  redirect_uri,
        'scope':         ' '.join(scopes),
        'state':         state,
        'nonce':         nonce,
    })
    return redirect(f"{cfg['authorization_endpoint']}?{params}")


@app.route('/auth/oidc/callback')
def oidc_callback():
    s = load_settings()
    if not s.get('oidc_enabled'):
        return redirect(url_for('login'))
    state = request.args.get('state', '')
    if not state or not secrets.compare_digest(state, session.get('oidc_state', '')):
        flash("Invalid OIDC state. Please try again.", "error")
        return redirect(url_for('login'))
    code = request.args.get('code', '')
    if not code:
        flash("OIDC login failed - no code returned.", "error")
        return redirect(url_for('login'))
    provider_url = s.get('oidc_provider_url', '').rstrip('/')
    try:
        disc = requests.get(f"{provider_url}/.well-known/openid-configuration", timeout=5)
        disc.raise_for_status()
        cfg = disc.json()
    except Exception:
        logger.exception("OIDC discovery failed in callback")
        flash("OIDC provider unavailable.", "error")
        return redirect(url_for('login'))
    try:
        token_resp = requests.post(cfg['token_endpoint'], data={
            'grant_type':   'authorization_code',
            'code':         code,
            'redirect_uri': url_for('oidc_callback', _external=True),
            'client_id':    s.get('oidc_client_id', ''),
            'client_secret': s.get('oidc_client_secret', ''),
        }, timeout=10)
        token_resp.raise_for_status()
        tokens = token_resp.json()
    except Exception:
        logger.exception("OIDC token exchange failed")
        flash("OIDC login failed - token exchange error.", "error")
        return redirect(url_for('login'))
    id_token = tokens.get('id_token', '')
    expected_nonce = session.pop('oidc_nonce', '')
    if id_token and expected_nonce:
        try:
            import base64, json as _json
            payload_b64 = id_token.split('.')[1]
            payload_b64 += '=' * (-len(payload_b64) % 4)
            id_claims = _json.loads(base64.urlsafe_b64decode(payload_b64))
            if not secrets.compare_digest(str(id_claims.get('nonce', '')), expected_nonce):
                logger.warning(f"OIDC nonce mismatch from {request.remote_addr}")
                flash("OIDC login failed - nonce mismatch.", "error")
                return redirect(url_for('login'))
        except Exception:
            logger.warning("OIDC id_token nonce verification skipped - could not decode token")
    access_token = tokens.get('access_token', '')
    try:
        userinfo_resp = requests.get(cfg['userinfo_endpoint'],
                                     headers={'Authorization': f'Bearer {access_token}'}, timeout=10)
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()
    except Exception:
        logger.exception("OIDC userinfo fetch failed")
        flash("OIDC login failed - could not fetch user info.", "error")
        return redirect(url_for('login'))
    email  = str(userinfo.get('email', '')).strip().lower()
    name   = str(userinfo.get('name', userinfo.get('preferred_username', email))).strip()
    groups = userinfo.get(s.get('oidc_groups_claim', 'groups'), [])
    if not isinstance(groups, list):
        groups = [str(groups)]
    _ev = userinfo.get('email_verified')
    email_unverified = _ev is False or (isinstance(_ev, str) and _ev.strip().lower() in ('false', '0', 'no'))
    allowed_emails = [e.strip().lower() for e in s.get('oidc_allowed_emails', '').split(',') if e.strip()]
    allowed_groups = [g.strip() for g in s.get('oidc_allowed_groups', '').split(',') if g.strip()]
    if not allowed_emails and not allowed_groups and not s.get('oidc_allow_any_authenticated'):
        logger.warning(f"OIDC login denied for {email!r} - no allowed emails/groups configured (set an allowlist or enable 'Allow any authenticated account')")
        flash("OIDC is enabled but no allowed emails or groups are configured. Ask an admin to set an allowlist.", "error")
        return redirect(url_for('login'))
    if allowed_emails and email not in allowed_emails:
        logger.warning(f"OIDC login denied for {email!r} - not in allowed emails")
        flash("Your account is not authorized to access this application.", "error")
        return redirect(url_for('login'))
    if allowed_emails and email in allowed_emails and email_unverified:
        logger.warning(f"OIDC login denied for {email!r} - email not verified by the identity provider")
        flash("Your account is not authorized to access this application.", "error")
        return redirect(url_for('login'))
    if allowed_groups and not any(g in allowed_groups for g in groups):
        logger.warning(f"OIDC login denied for {email!r} - no matching group")
        flash("Your account is not authorized to access this application.", "error")
        return redirect(url_for('login'))
    session.clear()
    session.update({
        'authenticated': True,
        'last_active':   time.time(),
        'login_time':    datetime.now(timezone.utc).isoformat(),
        'oidc_email':    email,
        'oidc_name':     name,
    })
    logger.info(f"OIDC login success for {email!r} from {request.remote_addr}")
    add_notification('info', f"OIDC login: {email} from {request.remote_addr}")
    return redirect(url_for('index'))


@app.route('/api/auth/oidc', methods=['GET'])
@login_required
def api_get_oidc():
    s = load_settings()
    return jsonify({
        'oidc_enabled':         s.get('oidc_enabled', False),
        'oidc_provider_url':    s.get('oidc_provider_url', ''),
        'oidc_client_id':       s.get('oidc_client_id', ''),
        'oidc_client_secret_set': bool(s.get('oidc_client_secret', '')),
        'oidc_display_name':    s.get('oidc_display_name', 'OIDC'),
        'oidc_allowed_emails':  s.get('oidc_allowed_emails', ''),
        'oidc_allowed_groups':  s.get('oidc_allowed_groups', ''),
        'oidc_allow_any_authenticated': bool(s.get('oidc_allow_any_authenticated', False)),
        'oidc_groups_claim':    s.get('oidc_groups_claim', 'groups'),
    })


@app.route('/api/auth/oidc', methods=['POST'])
@csrf_protect
@login_required
def api_save_oidc():
    try:
        data = request.get_json(silent=True) or {}
        s    = load_settings()
        secret_raw = str(data.get('oidc_client_secret', '')).strip()
        if not secret_raw:
            secret_raw = s.get('oidc_client_secret', '')
        save_settings(
            domains=s['domains'],
            cert_resolver=s['cert_resolver'],
            traefik_api_url=s['traefik_api_url'],
            auth_enabled=s.get('auth_enabled', True),
            password_hash=s.get('password_hash', ''),
            visible_tabs=s.get('visible_tabs'),
            oidc_enabled=bool(data.get('oidc_enabled', False)),
            oidc_provider_url=str(data.get('oidc_provider_url', '')).strip(),
            oidc_client_id=str(data.get('oidc_client_id', '')).strip(),
            oidc_client_secret=secret_raw,
            oidc_display_name=str(data.get('oidc_display_name', 'OIDC')).strip() or 'OIDC',
            oidc_allowed_emails=str(data.get('oidc_allowed_emails', '')).strip(),
            oidc_allowed_groups=str(data.get('oidc_allowed_groups', '')).strip(),
            oidc_allow_any_authenticated=bool(data.get('oidc_allow_any_authenticated', False)),
            oidc_groups_claim=str(data.get('oidc_groups_claim', 'groups')).strip() or 'groups',
        )
        reauth = _auth_required() and not session.get('authenticated')
        return jsonify({'ok': True, 'reauth_required': reauth})
    except Exception:
        logger.exception("OIDC save error")
        return jsonify({'ok': False, 'error': 'Save failed'}), 500


@app.route('/api/auth/oidc/test', methods=['POST'])
@csrf_protect
@login_required
def api_test_oidc():
    data = request.get_json(silent=True) or {}
    url  = str(data.get('provider_url', '')).strip().rstrip('/')
    if not url or not url.startswith(('http://', 'https://')):
        return jsonify({'ok': False, 'error': 'No provider URL'})
    if not _ssrf_ok(url):
        return jsonify({'ok': False, 'error': 'Target address not allowed'})
    logger.info(f"OIDC provider test to {url!r} by {request.remote_addr}")
    try:
        resp = requests.get(f"{url}/.well-known/openid-configuration", timeout=5)
        resp.raise_for_status()
        cfg = resp.json()
        return jsonify({'ok': True, 'issuer': cfg.get('issuer', url)})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})



def _redact_agent(a: dict) -> dict:
    out = dict(a)
    out['api_key'] = '***' if out.get('api_key') else ''
    out['crowdsec_api_key'] = '***' if out.get('crowdsec_api_key') else ''
    out['crowdsec_machine_password'] = '***' if out.get('crowdsec_machine_password') else ''
    out['git_backup_token'] = '***' if out.get('git_backup_token') else ''
    return out





@app.route('/api/mw/templates', methods=['GET'])
@login_required
def api_mw_templates_list():
    return jsonify({'templates': load_templates()})


@app.route('/api/mw/templates', methods=['POST'])
@csrf_protect
@login_required
def api_mw_templates_create():
    import uuid as _uuid
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()[:100]
    yaml_content = str(data.get('yaml', '')).strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    templates = load_templates()
    template = {'id': str(_uuid.uuid4()), 'name': name, 'yaml': yaml_content}
    templates.append(template)
    save_templates_file(templates)
    return jsonify({'ok': True, 'template': template})


@app.route('/api/mw/templates/<template_id>', methods=['PUT'])
@csrf_protect
@login_required
def api_mw_templates_update(template_id):
    data = request.get_json(silent=True) or {}
    templates = load_templates()
    updated = False
    for i, t in enumerate(templates):
        if t['id'] == template_id:
            if 'name' in data:
                templates[i]['name'] = str(data['name']).strip()[:100]
            if 'yaml' in data:
                templates[i]['yaml'] = str(data['yaml'])
            updated = True
            break
    if not updated:
        return jsonify({'error': 'Template not found'}), 404
    save_templates_file(templates)
    return jsonify({'ok': True})


@app.route('/api/mw/templates/<template_id>', methods=['DELETE'])
@csrf_protect
@login_required
def api_mw_templates_delete(template_id):
    templates = [t for t in load_templates() if t['id'] != template_id]
    save_templates_file(templates)
    return jsonify({'ok': True})


@app.route('/api/agents/<agent_id>/routes')
@login_required
def api_agent_routes(agent_id):
    agent = _agent_by_id(agent_id)
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404
    try:
        all_configs = _agent_load_configs(agent)

        config_errors = []
        try:
            r_resp = _agent_request(agent, 'GET', '/api/traefik/routers')
            s_resp = _agent_request(agent, 'GET', '/api/traefik/services')
            all_routers  = r_resp.json()  if r_resp.ok  else {}
            all_services = s_resp.json()  if s_resp.ok  else {}
            if not r_resp.ok:
                try:
                    err = r_resp.json().get('error') or r_resp.text
                except Exception:
                    err = r_resp.text
                config_errors.append({'file': "Agent Traefik API", 'error': err or f'HTTP {r_resp.status_code}'})
        except Exception as e:
            all_routers  = {}
            all_services = {}
            config_errors.append({'file': "Agent Traefik API", 'error': str(e)})

        svc_urls = _traefik_service_url_map(all_services)

        combined_http, combined_tcp, combined_udp = {}, {}, {}
        for config in all_configs.values():
            for k, v in config.get('http', {}).get('services', {}).items():
                combined_http.setdefault(k, v)
            for k, v in config.get('tcp',  {}).get('services', {}).items():
                combined_tcp.setdefault(k, v)
            for k, v in config.get('udp',  {}).get('services', {}).items():
                combined_udp.setdefault(k, v)

        apps, middlewares = [], []
        for fname, config in all_configs.items():
            apps.extend(_build_apps(config, config_file=fname,
                                    extra_http_svcs=combined_http,
                                    extra_tcp_svcs=combined_tcp,
                                    extra_udp_svcs=combined_udp,
                                    api_svc_urls=svc_urls))
            middlewares.extend(_build_middlewares(config, config_file=fname))

        apps.extend(_build_external_routes(all_routers, svc_urls))

        prefix = f"agent_{agent_id}::"
        for store_key, rdata in load_settings().get('disabled_routes', {}).items():
            if not store_key.startswith(prefix):
                continue
            rid      = store_key[len(prefix):]
            rname    = rid.split('::', 1)[1] if '::' in rid else rid
            proto    = rdata.get('protocol', 'http')
            router   = rdata.get('router', {})
            svc_name = router.get('service', '')
            svc      = rdata.get('service', {})
            cf       = rdata.get('configFile', '')
            servers  = svc.get('loadBalancer', {}).get('servers', [])
            if proto == 'http':
                target = servers[0].get('url', 'N/A') if servers else 'N/A'
                apps.append({'id': rid, 'name': rname, 'rule': router.get('rule', ''),
                             'service_name': svc_name, 'target': target,
                             'middlewares': router.get('middlewares', []),
                             'entryPoints': router.get('entryPoints', []),
                             'protocol': 'http', 'tls': bool(router.get('tls')), 'enabled': False,
                             'passHostHeader': svc.get('loadBalancer', {}).get('passHostHeader', True),
                             'serviceType': _service_type(svc),
                             'configFile': cf, 'provider': 'file', 'entrypointMiddlewares': []})
            else:
                target = servers[0].get('address', 'N/A') if servers else 'N/A'
                apps.append({'id': rid, 'name': rname, 'rule': router.get('rule', ''),
                             'service_name': svc_name, 'target': target,
                             'middlewares': router.get('middlewares', []) if proto == 'tcp' else [],
                             'entryPoints': router.get('entryPoints', []),
                             'protocol': proto, 'tls': bool(router.get('tls')) if proto == 'tcp' else False,
                             'serviceType': _service_type(svc),
                             'enabled': False, 'configFile': cf, 'provider': 'file'})

        _mm_ledger       = load_settings().get('managed_middlewares', {})
        _http_mw_by_file = {fn: ((cfg.get('http') or {}).get('middlewares') or {}) for fn, cfg in all_configs.items()}
        for _app in apps:
            if _app.get('protocol') != 'http' or _app.get('provider') != 'file':
                continue
            hdr_mw_name = f"{_app.get('name')}-headers"
            hdr_body    = _http_mw_by_file.get(_app.get('configFile', ''), {}).get(hdr_mw_name)
            owned       = f"agent_{agent_id}::{hdr_mw_name}" in _mm_ledger
            decoded     = _decode_headers_middleware(hdr_body) if (owned and hdr_body is not None) else None
            if not owned or hdr_body is None:
                hdr_state = 'off'
            elif decoded is not None:
                hdr_state = 'toggles'
            else:
                hdr_state = 'custom'
            _app['headersPreset'] = {
                'owned':   owned,
                'exists':  hdr_body is not None,
                'state':   hdr_state,
                'toggles': decoded if decoded is not None else _headers_preset_defaults(),
            }

        return jsonify({'apps': apps, 'middlewares': middlewares, 'configErrors': config_errors})
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Cannot reach agent'}), 502
    except Exception as e:
        logger.exception("Agent routes error")
        return jsonify({'error': str(e)}), 500


def _agent_api_cert_resolvers(agent) -> list:
    found = []
    try:
        resp = _agent_request(agent, 'GET', '/api/traefik/routers')
        if resp.status_code != 200:
            return found
        data = resp.json() or {}
        for proto in ('http', 'tcp'):
            for r in (data.get(proto) or []):
                if not isinstance(r, dict):
                    continue
                tls = r.get('tls')
                if not isinstance(tls, dict):
                    continue
                name = str(tls.get('certResolver') or '').strip()
                if name and name not in found:
                    found.append(name)
    except Exception:
        logger.debug("Failed to read cert resolvers from agent Traefik API", exc_info=True)
    return found


@app.route('/api/agents/<agent_id>/cert-resolvers')
@login_required
def api_agent_cert_resolvers(agent_id):
    agent = _agent_by_id(agent_id)
    if not agent:
        return jsonify({'resolvers': []})
    configured = [r.strip() for r in (agent.get('cert_resolver') or '').split(',') if r.strip()]
    for name in _agent_api_cert_resolvers(agent):
        if name not in configured:
            configured.append(name)
    try:
        resp = _agent_request(agent, 'GET', '/api/static')
        if resp.status_code != 200:
            return jsonify({'resolvers': configured})
        content   = (resp.json() or {}).get('content', '')
        data      = _yaml_safe.load(content) or {}
        resolvers = data.get('certificatesResolvers') or {}
        if isinstance(resolvers, dict):
            for k in resolvers:
                k = str(k).strip()
                if k and k not in configured:
                    configured.append(k)
    except Exception:
        logger.debug("Failed to read agent cert resolvers", exc_info=True)
    return jsonify({'resolvers': configured})


@app.route('/api/agents', methods=['GET'])
@login_required
def api_agents_list():
    agents = load_settings().get('agents', [])
    return jsonify({'agents': [_redact_agent(a) for a in agents]})


@app.route('/api/agents', methods=['POST'])
@csrf_protect
@login_required
def api_agents_create():
    import uuid as _uuid
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()[:100]
    url  = str(data.get('url', '')).strip().rstrip('/')
    if not name or not url:
        return jsonify({'error': 'name and url are required'}), 400
    raw_key = secrets.token_urlsafe(32)
    agent = {
        'id':         str(_uuid.uuid4()),
        'name':       name,
        'url':        url,
        'api_key':    raw_key,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'traefik_api_url':       str(data.get('traefik_api_url', 'http://traefik:8080')).strip(),
        'cert_resolver':         str(data.get('cert_resolver', '')).strip(),
        'config_path':           str(data.get('config_path', '/app/config')).strip(),
        'backup_keep_count':     str(data.get('backup_keep_count', '')).strip(),
        'static_config_path':    str(data.get('static_config_path', '')).strip(),
        'acme_json_path':        str(data.get('acme_json_path', '')).strip(),
        'access_log_path':       str(data.get('access_log_path', '')).strip(),
        'plugins_dir':           str(data.get('plugins_dir', '')).strip(),
        'restart_method':        str(data.get('restart_method', '')).strip(),
        'traefik_container':     str(data.get('traefik_container', 'traefik')).strip(),
        'docker_host':           str(data.get('docker_host', '')).strip(),
        'signal_file_path':      str(data.get('signal_file_path', '')).strip(),
        'crowdsec_lapi_url':     str(data.get('crowdsec_lapi_url', '')).strip(),
        'crowdsec_api_key':      str(data.get('crowdsec_api_key', '')).strip(),
        'crowdsec_machine_id':       str(data.get('crowdsec_machine_id', '')).strip(),
        'crowdsec_machine_password': str(data.get('crowdsec_machine_password', '')).strip(),
        'git_backup_enabled':    bool(data.get('git_backup_enabled', False)),
        'git_backup_repo':       str(data.get('git_backup_repo', '')).strip(),
        'git_backup_branch':     str(data.get('git_backup_branch', 'main')).strip() or 'main',
        'git_backup_username':   str(data.get('git_backup_username', '')).strip(),
        'git_backup_token':      str(data.get('git_backup_token', '')).strip(),
        'git_backup_auto_push':  bool(data.get('git_backup_auto_push', True)),
        'git_backup_commit_message': str(data.get('git_backup_commit_message', 'traefik-manager: {action} at {timestamp}')).strip() or 'traefik-manager: {action} at {timestamp}',
    }
    agents = load_agents()
    agents.append(agent)
    save_agents_file(agents)
    result = _redact_agent(agent)
    result['api_key_raw'] = raw_key
    return jsonify({'ok': True, 'agent': result})


@app.route('/api/agents/<agent_id>', methods=['PUT'])
@csrf_protect
@login_required
def api_agents_update(agent_id):
    data    = request.get_json(silent=True) or {}
    agents  = load_agents()
    if 'git_host_branch' in data or data.get('git_host_backup'):
        s = load_settings()
        target = next((a for a in agents if a.get('id') == agent_id), {})
        branch = _safe_git_branch(str(data.get('git_host_branch', target.get('git_host_branch') or '')).strip() or _agent_git_branch({**target, 'git_host_branch': ''}))
        enabled = bool(data.get('git_host_backup', target.get('git_host_backup')))
        if enabled:
            if branch == _safe_git_branch(s.get('git_backup_branch', 'main')):
                return jsonify({'ok': False, 'error': f'Branch "{branch}" is used by the Host - each server needs its own branch'}), 400
            for other in agents:
                if other.get('id') != agent_id and other.get('git_host_backup') and _agent_git_branch(other) == branch:
                    return jsonify({'ok': False, 'error': f'Branch "{branch}" is already used by agent "{other.get("name")}"'}), 400
        if 'git_host_branch' in data:
            data['git_host_branch'] = branch
    updated = False
    for i, a in enumerate(agents):
        if a.get('id') == agent_id:
            updatable = [
                'name', 'url', 'traefik_api_url', 'traefik_insecure_skip_verify',
                'cert_resolver',
                'config_path', 'static_config_path',
                'acme_json_path', 'access_log_path', 'plugins_dir', 'backup_dir', 'backup_keep_count',
                'restart_method', 'traefik_container', 'docker_host', 'signal_file_path',
                'crowdsec_lapi_url', 'crowdsec_machine_id', 'git_backup_enabled', 'git_backup_repo',
                'git_backup_branch', 'git_backup_username', 'git_backup_auto_push',
                'git_backup_commit_message', 'tma_port', 'tma_rate_limit', 'domains',
                'git_host_backup', 'git_host_branch',
            ]
            for field in updatable:
                if field in data:
                    agents[i][field] = data[field]
            if 'crowdsec_api_key' in data and data['crowdsec_api_key'] not in ('', '***'):
                agents[i]['crowdsec_api_key'] = str(data['crowdsec_api_key'])
            if 'crowdsec_machine_password' in data and data['crowdsec_machine_password'] not in ('', '***'):
                agents[i]['crowdsec_machine_password'] = str(data['crowdsec_machine_password'])
            if 'git_backup_token' in data and data['git_backup_token'] not in ('', '***'):
                agents[i]['git_backup_token'] = str(data['git_backup_token'])
            updated = True
            break
    if not updated:
        return jsonify({'error': 'Agent not found'}), 404
    save_agents_file(agents)
    return jsonify({'ok': True})


@app.route('/api/agents/<agent_id>', methods=['DELETE'])
@csrf_protect
@login_required
def api_agents_delete(agent_id):
    agents = [a for a in load_agents() if a.get('id') != agent_id]
    save_agents_file(agents)
    return jsonify({'ok': True})


@app.route('/api/agents/<agent_id>/rotate-key', methods=['POST'])
@csrf_protect
@login_required
def api_agents_rotate_key(agent_id):
    try:
        agents = load_agents()
        idx    = next((i for i, a in enumerate(agents) if a.get('id') == agent_id), None)
        if idx is None:
            return jsonify({'error': 'Agent not found'}), 404
        raw_key = secrets.token_urlsafe(32)
        agents[idx] = dict(agents[idx])
        agents[idx]['api_key'] = raw_key
        save_agents_file(agents)
        result = _redact_agent(agents[idx])
        result['api_key_raw'] = raw_key
        return jsonify({'ok': True, 'agent': result})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/agents/<agent_id>/health', methods=['GET'])
@login_required
def api_agents_health(agent_id):
    agent = _agent_by_id(agent_id)
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404
    try:
        t0   = time.time()
        resp = requests.get(agent['url'].rstrip('/') + '/health', timeout=5)
        ms   = int((time.time() - t0) * 1000)
        body = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        return jsonify({'ok': resp.status_code == 200, 'latency_ms': ms, 'version': body.get('version', ''), 'status': resp.status_code})
    except requests.exceptions.ConnectionError:
        return jsonify({'ok': False, 'latency_ms': -1, 'error': 'Connection refused'})
    except Exception as e:
        return jsonify({'ok': False, 'latency_ms': -1, 'error': str(e)})


@app.route('/api/agents/proxy/<agent_id>/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
@csrf_protect
@login_required
def api_agents_proxy(agent_id, path):
    agent = _agent_by_id(agent_id)
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404
    try:
        kwargs = {}
        if request.content_type and 'json' in request.content_type:
            kwargs['json'] = request.get_json(silent=True)
        elif request.data:
            kwargs['data'] = request.data
        agent_path = '/api/' + path.lstrip('/')
        if request.query_string:
            kwargs['params'] = request.query_string
        resp = _agent_request(agent, request.method, agent_path, **kwargs)
        if (request.method in ('POST', 'PUT', 'DELETE') and resp.status_code < 400
                and not agent_path.startswith('/api/backup/git')
                and any(agent_path.startswith(x) for x in ('/api/configs', '/api/routes', '/api/middlewares', '/api/static', '/api/restore/', '/api/backup/'))):
            threading.Thread(target=lambda: _git_push_agent_if_enabled(agent, 'config change'), daemon=True).start()
        content_type = resp.headers.get('content-type', 'application/json')
        return resp.content, resp.status_code, {'Content-Type': content_type}
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Cannot reach agent - check URL and network'}), 502
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Agent timed out'}), 504
    except Exception as e:
        logger.exception("Agent proxy error")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info("Development server starting...")
    app.run(host='0.0.0.0', port=5000, debug=False)
else:
    logger.info("🟢 Traefik Manager: Server is UP and Ready")
