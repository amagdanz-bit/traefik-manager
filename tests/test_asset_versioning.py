import os
import re

from core.env import APP_VERSION

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VERSIONED = re.compile(r'/static/(?:css|js)/[\w./-]+\?v=([^"\']*)')


def _templates():
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, 'templates')):
        dirnames[:] = [d for d in dirnames if d != '__pycache__']
        for name in filenames:
            if name.endswith('.html'):
                yield os.path.relpath(os.path.join(dirpath, name), ROOT)


def test_every_versioned_asset_uses_the_app_version():
    offenders = []
    for rel in _templates():
        with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
            for n, line in enumerate(fh, 1):
                for value in VERSIONED.findall(line):
                    if value.strip() != '{{ asset_version }}':
                        offenders.append('%s:%d  ?v=%s' % (rel, n, value))

    assert not offenders, (
        'a hardcoded asset version goes stale on the next release, and every '
        'browser then keeps serving the old CSS or JS from cache:\n  '
        + '\n  '.join(offenders))


def test_the_stylesheet_is_stamped_with_the_running_version(client):
    html = client.get('/').data.decode()
    assert '/static/css/app.css?v=%s' % APP_VERSION in html, (
        'app.css is not cache busted with the current version, so the redesigned '
        'stat panel would render against a cached copy of the old stylesheet')
