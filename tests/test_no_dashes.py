import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCAN = ['app.py', 'core', 'tests', 'templates', 'docs', 'scripts',
        os.path.join('static', 'js'), os.path.join('static', 'css')]

SKIP_DIRS = {'vendor', 'node_modules', '__pycache__', 'dist', 'cache', 'public'}

SUFFIXES = ('.py', '.js', '.mjs', '.ts', '.mts', '.vue', '.css', '.html', '.md', '.yml', '.yaml')

DASH = re.compile('[%s%s]|' % (chr(0x2013), chr(0x2014))
                  + r'\\u201[34]|&[mn]dash;|&#821[12];')


def _files():
    for target in SCAN:
        path = os.path.join(ROOT, target)
        if os.path.isfile(path):
            yield path
            continue
        for root, dirs, names in os.walk(path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for name in names:
                if name.endswith(SUFFIXES):
                    yield os.path.join(root, name)


def test_no_em_or_en_dashes():
    offenders = []
    for path in _files():
        with open(path, encoding='utf-8', errors='replace') as fh:
            for n, line in enumerate(fh, 1):
                if DASH.search(line):
                    rel = os.path.relpath(path, ROOT)
                    offenders.append('%s:%d  %s' % (rel, n, line.strip()[:90]))

    assert not offenders, (
        'use a plain hyphen, not an em or en dash (escapes and HTML entities '
        'count):\n  ' + '\n  '.join(offenders))
