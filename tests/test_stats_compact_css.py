import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RUNTIME_SWITCH = '.sig-compact'
FIRST_PAINT_SWITCH = 'html.tm-compact-stats'

ANSWER_CLASSES = ('sig-total', 'sig-verdict-txt', 'sig-sub', 'sig-ep-n', 'sig-metric')


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as fh:
        return fh.read()


def _rules(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        selector = ' '.join(m.group(1).split())
        if not selector or selector.startswith('@'):
            continue
        yield selector, m.group(2)


def _inline_style():
    blocks = re.findall(r'<style>(.*?)</style>', _read('templates', 'index.html'), re.S)
    assert blocks, 'templates/index.html lost its anti-FOUC <style> block'
    return '\n'.join(blocks)


def _compact_targets(selector_list):
    runtime, first_paint = set(), set()
    for part in selector_list.split(','):
        part = ' '.join(part.split())
        if RUNTIME_SWITCH in part:
            runtime.add(' '.join(part.replace(RUNTIME_SWITCH, ' ').split()))
        elif 'tm-compact-stats' in part:
            first_paint.add(' '.join(re.sub(r'html\.tm-compact-stats', ' ', part).split()))
    return runtime, first_paint


def _simple_selectors(selector_list, switch_tokens):
    found = set()
    for token in re.findall(r'[.#][\w-]+', selector_list):
        if token.lstrip('.#') not in switch_tokens:
            found.add(token)
    return found


def test_every_compact_rule_carries_both_switches():
    problems = []
    for selector, _ in _rules(_read('static', 'css', 'app.css')):
        runtime, first_paint = _compact_targets(selector)
        if not runtime and not first_paint:
            continue
        if runtime != first_paint:
            problems.append(
                '%s\n      via %s: %s\n      via %s: %s'
                % (selector, RUNTIME_SWITCH, sorted(runtime) or '(none)',
                   FIRST_PAINT_SWITCH, sorted(first_paint) or '(none)'))

    assert not problems, (
        'compact mode is reached two ways: html.tm-compact-stats is set before the '
        'first paint by the inline script in templates/index.html, and .sig-compact '
        'is toggled on #statsPanel afterwards by applyUiPrefs(). Every compact rule '
        'must target the same elements through both, or the layout flashes on load '
        'or fails to follow the toggle:\n  ' + '\n  '.join(problems))


def test_the_stylesheet_declares_the_class_the_page_sets_before_paint():
    index = _read('templates', 'index.html')
    assert "d.add('tm-compact-stats')" in index, (
        'the inline script no longer marks the document for compact mode, so the '
        'first paint always uses the full layout')
    assert 'tm-compact-stats' in _read('static', 'css', 'app.css'), (
        'templates/index.html sets html.tm-compact-stats before paint but '
        'static/css/app.css defines nothing for it, so the class does nothing')


def test_every_preference_class_the_page_sets_is_styled_somewhere():
    index = _read('templates', 'index.html')
    styled = _inline_style() + _read('static', 'css', 'app.css')
    added = sorted(set(re.findall(r"d\.add\('(tm-[\w-]+)'\)", index)))
    assert added, 'the anti-FOUC script no longer sets any preference class'

    orphans = [c for c in added if c not in styled]
    assert not orphans, (
        'the inline script sets these classes before paint but nothing styles them, '
        'so the preference is silently ignored until the JS runs: %s' % orphans)


def test_the_anti_fouc_block_never_redeclares_compact_layout_on_its_own():
    inline_targets, css_targets = set(), set()
    for selector, _ in _rules(_inline_style()):
        if 'tm-compact-stats' in selector:
            inline_targets |= _simple_selectors(selector, {'tm-compact-stats'})
    for selector, _ in _rules(_read('static', 'css', 'app.css')):
        runtime, first_paint = _compact_targets(selector)
        if runtime or first_paint:
            css_targets |= _simple_selectors(selector, {'tm-compact-stats', 'sig-compact'})

    drifted = sorted(inline_targets - css_targets)
    assert not drifted, (
        'templates/index.html styles %s for compact mode inline, but '
        'static/css/app.css has no compact rule for them. Two copies of the same '
        'layout in two files is exactly how the last compact mode drifted out of '
        'sync; keep the compact rules in app.css only.' % drifted)


def test_the_anti_fouc_gates_target_elements_that_exist():
    stats = _read('templates', 'sections', 'stats.html')
    declared = set(re.findall(r'id="([A-Za-z][\w-]*)"', stats))

    gated = set()
    for selector, _ in _rules(_inline_style()):
        if 'tm-hide-stats' in selector or 'tm-hide-entrypoints' in selector or 'tm-scope-dash' in selector:
            gated |= {t[1:] for t in re.findall(r'#[\w-]+', selector)}

    missing = sorted(gated - declared)
    assert not missing, (
        'the anti-FOUC block hides %s, but templates/sections/stats.html no longer '
        'declares them, so the show/hide and dashboard-scope preferences do nothing '
        'until the JS runs.' % missing)


def test_the_settings_code_toggles_both_compact_switches():
    js = _read('static', 'js', 'settings-modal.js')
    assert "classList.toggle('tm-compact-stats'" in js, (
        'applyUiPrefs() must keep html.tm-compact-stats in step with the preference')
    assert "classList.toggle('sig-compact'" in js, (
        'applyUiPrefs() must toggle .sig-compact so the change applies without a reload')
    assert "getElementById('statsPanel')" in js, (
        '.sig-compact belongs on #statsPanel; the CSS is written as '
        '.sig-root .sig-compact <target>')


def test_no_rule_hides_an_answer_the_dashboard_writes():
    offenders = []
    for source, css in (('static/css/app.css', _read('static', 'css', 'app.css')),
                        ('templates/index.html', _inline_style())):
        for selector, body in _rules(css):
            if not re.search(r'(?<![\w-])display\s*:\s*none', body):
                continue
            for part in selector.split(','):
                for cls in ANSWER_CLASSES:
                    if re.search(r'\.%s(?![\w-])' % re.escape(cls), part):
                        offenders.append('%s: %s' % (source, ' '.join(part.split())))

    assert not offenders, (
        'the previous stat cards wrote the total into .stat-count and then hid it '
        'with display:none in both modes, so the headline number was unanswerable. '
        'These rules hide an element the dashboard fills with an answer:\n  '
        + '\n  '.join(sorted(set(offenders))))


def test_the_hero_total_is_styled_for_both_modes():
    css = _read('static', 'css', 'app.css')
    sizes = [body for selector, body in _rules(css)
             if re.search(r'\.sig-total(?![\w-])', selector)
             and re.search(r'(?<![\w-])font-size', body)]
    assert len(sizes) >= 2, (
        'the hero total should have a full-mode size and a compact-mode size; '
        'found %d rule(s) setting font-size on .sig-total' % len(sizes))
