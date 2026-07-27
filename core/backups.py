"""Timestamped backups of the dynamic config files."""
import os
import re
import shutil
import time

from core import env
from core import settings as settings_mod
from core.env import logger


def ensure_backup_dir():
    if not os.path.exists(env.BACKUP_DIR):
        os.makedirs(env.BACKUP_DIR)

def _backup_keep_count() -> int:
    try:
        v = settings_mod.load_settings().get('backup_keep_count')
        if v in (None, ''):
            v = os.environ.get('BACKUP_KEEP_COUNT', '0')
        return max(0, int(v))
    except Exception:
        return 0

def _prune_backups(base: str):
    """Keep only the newest N .bak files for a given config file (0 = keep all)."""
    keep = _backup_keep_count()
    if keep <= 0:
        return
    pat = re.compile(r'^' + re.escape(base) + r'\.(\d{8}_\d{6})\.bak$')
    matches = sorted(
        (f for f in os.listdir(env.BACKUP_DIR) if pat.match(f)),
        reverse=True,
    )
    for f in matches[keep:]:
        try:
            os.remove(os.path.join(env.BACKUP_DIR, f))
            logger.info(f"Pruned old backup: {f}")
        except OSError:
            pass

def create_backup(path=None):
    if path is None:
        path = env.CONFIG_PATH
    ensure_backup_dir()
    if os.path.exists(path):
        ts   = time.strftime("%Y%m%d_%H%M%S")
        base = os.path.basename(path)
        dest = os.path.join(env.BACKUP_DIR, f"{base}.{ts}.bak")
        shutil.copy2(path, dest)
        logger.info(f"Backup created: {dest}")
        _prune_backups(base)
        return dest
    return None
