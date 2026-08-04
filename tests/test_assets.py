import os
import re
from fnmatch import fnmatch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, 'tailwind.config.js')

SKIP_DIRS = {'.git', 'node_modules', 'vendor', 'docs', 'tests', 'agent',
             '.github', 'unraid', 'images', '__pycache__', '.pytest_cache'}

TAILWIND_MARKERS = re.compile(
    r'\bclass\s*=\s*["\'`][^"\'`]*\b('
    r'flex|grid|hidden|block|truncate|opacity-\d+|gap-\d|p[xytblr]?-\d|m[xytblr]?-\d'
    r'|text-(?:xs|sm|base|lg|xl)|font-(?:bold|semibold|medium|mono)'
    r'|w-\d+|h-\d+|rounded|border|items-|justify-|space-[xy]-|sm:|md:|lg:'
    r')'
)


def _content_globs():
    src = open(CONFIG).read()
    block = re.search(r'content\s*:\s*\[(.*?)\]', src, re.S)
    assert block, 'could not find the content array in tailwind.config.js'
    return re.findall(r'["\']([^"\']+)["\']', block.group(1))


def _covered(rel_path, globs):
    candidates = {rel_path, './' + rel_path}
    for g in globs:
        for c in candidates:
            if fnmatch(c, g):
                return True
        rx = re.escape(g).replace(r'\*\*/', '(?:.*/)?').replace(r'\*\*', '.*').replace(r'\*', '[^/]*')
        rx = rx.replace(r'\./', '')
        if re.fullmatch(rx, rel_path):
            return True
    return False


def _markup_sources():
    found = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if not fn.endswith(('.html', '.js', '.jinja', '.j2')):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            try:
                text = open(full, encoding='utf-8').read()
            except (UnicodeDecodeError, OSError):
                continue
            if TAILWIND_MARKERS.search(text):
                found.append(rel)
    return sorted(found)


def test_tailwind_content_globs_cover_every_markup_source():
    globs = _content_globs()
    uncovered = [p for p in _markup_sources() if not _covered(p, globs)]
    assert not uncovered, (
        'These files emit Tailwind classes but are not scanned by Tailwind, so '
        'their classes will be purged from the built CSS:\n  '
        + '\n  '.join(uncovered)
        + '\n\nFix: add the path to `content` in tailwind.config.js.\n'
          'Current globs: %r' % (globs,)
    )


def test_static_js_is_scanned():
    globs = _content_globs()
    assert _covered('static/js/routes.js', globs), (
        'static/js is not in the tailwind content globs - classes used only in '
        'JS-generated markup will be purged. Current globs: %r' % (globs,))


def test_known_js_only_classes_are_still_referenced():
    js_dir = os.path.join(ROOT, 'static', 'js')
    blob = ''
    for fn in os.listdir(js_dir):
        if fn.endswith('.js'):
            blob += open(os.path.join(js_dir, fn), encoding='utf-8').read()
    for cls in ('opacity-50', 'sm:grid-cols-3'):
        assert cls in blob, (
            '%r no longer appears in static/js. If that is intentional, update '
            'this canary list.' % cls)


ICON_BUTTON = re.compile(
    r'class="tm-info-btn"(?:[^>"]|"[^"]*")*>(.*?)</span>', re.S)


def test_info_buttons_use_the_icon_not_a_bare_letter():
    bad = []
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, 'templates')):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if not fn.endswith('.html'):
                continue
            path = os.path.join(dirpath, fn)
            for m in ICON_BUTTON.finditer(open(path, encoding='utf-8').read()):
                inner = m.group(1).strip()
                if 'ph-' not in inner:
                    bad.append('%s: <span class="tm-info-btn" ...>%s</span>'
                               % (os.path.relpath(path, ROOT), inner[:40]))
    assert not bad, (
        'info buttons rendering something other than an icon:\n  ' + '\n  '.join(bad))
