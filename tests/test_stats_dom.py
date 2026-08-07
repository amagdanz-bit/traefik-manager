import collections
import os
import re
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STATS_SECTION = os.path.join('templates', 'sections', 'stats.html')

WIRED_IDS = {'overviewSection', 'statsPanel', 'statsGrid', 'sigVerdict', 'sigKey',
             'sigRuntime', 'entrypointsBar'}

RETIRED = ('stat-card', 'stat-count', 'stat-counts', 'stat-bar', 'stat-legend',
           'stat-exp-header', 'stat-exp-body', 'stat-cmp-header', 'stat-cmp-body',
           'stats-compact', 'ep-pill', 'renderDonut', 'renderBar')


class _IdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        value = dict(attrs).get('id')
        if value:
            self.ids.append(value)


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as fh:
        return fh.read()


def _ids(markup):
    parser = _IdCollector()
    parser.feed(markup)
    return parser.ids


def _duplicates(ids):
    return sorted(i for i, n in collections.Counter(ids).items() if n > 1)


def _markup_files():
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, 'templates')):
        dirnames[:] = [d for d in dirnames if d != '__pycache__']
        for name in filenames:
            if name.endswith('.html'):
                yield os.path.relpath(os.path.join(dirpath, name), ROOT)
    js_dir = os.path.join(ROOT, 'static', 'js')
    for name in sorted(os.listdir(js_dir)):
        if name.endswith('.js'):
            yield os.path.join('static', 'js', name)
    yield os.path.join('static', 'css', 'app.css')


def test_the_stats_section_has_no_duplicate_ids():
    dupes = _duplicates(_ids(_read(STATS_SECTION)))
    assert not dupes, (
        '%s declares these ids more than once: %s\n'
        'The stat panel renders one DOM for both full and compact mode. A repeated '
        'id means a second, hidden card tree has crept back in, and getElementById '
        'will only ever reach the first copy.' % (STATS_SECTION, dupes))


def test_the_rendered_page_has_no_duplicate_ids(client):
    dupes = _duplicates(_ids(client.get('/').data.decode()))
    assert not dupes, (
        'the dashboard renders these ids more than once: %s\n'
        'Every lookup in the JS resolves to the first one, so the duplicates are '
        'written to and never seen, or read from and never updated.' % dupes)


def test_the_stats_section_declares_every_id_the_javascript_drives():
    declared = set(_ids(_read(STATS_SECTION)))
    missing = sorted(WIRED_IDS - declared)
    assert not missing, (
        '%s no longer declares %s.\n'
        'static/js/dashboard.js, static/js/settings-modal.js and the anti-FOUC '
        'block in templates/index.html all address the stat panel by these ids.'
        % (STATS_SECTION, missing))


def test_every_stat_panel_id_the_javascript_looks_up_exists():
    template = _read(STATS_SECTION)
    dashboard = _read('static', 'js', 'dashboard.js')
    declared = set(_ids(template)) | set(re.findall(r'id="([A-Za-z][\w-]*)"', dashboard))

    wanted = set()
    for source in ('dashboard.js', 'settings-modal.js', 'core.js'):
        text = _read('static', 'js', source)
        wanted.update(re.findall(
            r"getElementById\('(overviewSection|statsPanel|statsGrid|sig[A-Z]\w*|entrypoints\w*)'\)",
            text))

    missing = sorted(wanted - declared)
    assert not missing, (
        'the JS looks up %s, but no template and no JS-built markup declares them. '
        'Those lookups return null and the panel silently stops updating.' % missing)


def test_compact_mode_is_not_baked_into_the_markup():
    offenders = [f for f in _markup_files()
                 if f.endswith('.html') and 'sig-compact' in _read(f)]
    assert not offenders, (
        'sig-compact is applied at runtime by applyUiPrefs() to #statsPanel; the '
        'first paint is handled by html.tm-compact-stats instead. Hard-coding it '
        'into %s pins every visitor to compact mode.' % offenders)


def test_the_retired_stat_card_vocabulary_is_gone():
    offenders = []
    for rel in _markup_files():
        text = _read(rel)
        for token in RETIRED:
            if re.search(r'(?<![\w-])%s(?![\w-])' % re.escape(token), text):
                offenders.append('%s: %s' % (rel, token))
    assert not offenders, (
        'the old stat card implementation kept a parallel compact DOM and a donut. '
        'These references bring back a class or function the redesign deleted, so '
        'they style or drive nothing:\n  ' + '\n  '.join(offenders))
