import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as fh:
        return fh.read()


def _list_from(pattern, text, label):
    m = re.search(pattern, text, re.M)
    assert m, 'no OPTIONAL_TABS found in %s' % label
    return re.findall(r"'([a-z_]+)'", m.group(1))


def test_optional_tabs_match_between_python_and_js():
    py = _list_from(r'^OPTIONAL_TABS = \[(.*?)\]', _read('core', 'settings.py'), 'core/settings.py')
    js = _list_from(r'^const OPTIONAL_TABS = \[(.*?)\];', _read('static', 'js', 'core.js'), 'static/js/core.js')
    assert py == js, (
        'core/settings.py gates the server, static/js/core.js gates applyTabVisibility.\n'
        'A tab missing from the JS list is saved as enabled but its button never leaves display:none.\n'
        '  python: %s\n  js:     %s\n  only in python: %s\n  only in js:     %s'
        % (py, js, sorted(set(py) - set(js)), sorted(set(js) - set(py))))


def test_every_optional_tab_has_a_button_and_a_content_div():
    tabs = _list_from(r'^OPTIONAL_TABS = \[(.*?)\]', _read('core', 'settings.py'), 'core/settings.py')
    index = _read('templates', 'index.html')
    includes = re.findall(r"\{%\s*include\s*'tabs/([a-z_]+\.html)'", index)
    bodies = ''.join(_read('templates', 'tabs', f) for f in includes)

    missing_btn = [t for t in tabs if 'id="btn-%s"' % t not in index]
    missing_div = [t for t in tabs if 'id="tab-%s"' % t not in bodies + index]

    assert not missing_btn, 'optional tabs with no tab-bar button: %s' % missing_btn
    assert not missing_div, (
        'optional tabs with no #tab-<key> content div: %s\n'
        'switchTab() would leave every panel hidden for these.' % missing_div)
