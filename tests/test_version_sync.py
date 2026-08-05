import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as fh:
        return fh.read()


def _app_version():
    m = re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', _read('core', 'env.py'), re.M)
    assert m, 'APP_VERSION not found in core/env.py'
    return m.group(1)


def _find(label, pattern, *parts):
    m = re.search(pattern, _read(*parts), re.M)
    assert m, '%s: no version found in %s' % (label, os.path.join(*parts))
    return m.group(1)


def test_every_version_string_matches_app_version():
    want = _app_version()
    found = {
        'static/sw.js': _find('sw.js', r"^const CACHE_NAME = 'traefik-manager-v([^']+)'", 'static', 'sw.js'),
        'agent/main.go': _find('agent', r'^const Version = "([^"]+)"', 'agent', 'main.go'),
        'static/openapi.yaml': _find('openapi', r'^  version:\s*(\S+)', 'static', 'openapi.yaml'),
        'docs/public/openapi.yaml': _find('docs openapi', r'^  version:\s*(\S+)', 'docs', 'public', 'openapi.yaml'),
        'docs/.vitepress/config.ts': _find('docs nav', r"^\s+text: 'v(\d+\.\d+\.\d+)',", 'docs', '.vitepress', 'config.ts'),
    }
    stale = {k: v for k, v in found.items() if v != want}
    assert not stale, (
        'core/env.py says %s, but these disagree:\n  ' % want
        + '\n  '.join('%s = %s' % (k, v) for k, v in sorted(stale.items()))
        + '\n\nThe agent bakes its version in at build time (no ldflags), so a stale '
          'value makes every agent report as outdated after a release.')
