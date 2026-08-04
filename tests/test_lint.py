import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = ['app.py', 'core', 'tests']

FATAL_CODES = (
    'F821',
    'F823',
    'F811',
    'F841',
)


def _run_ruff():
    proc = subprocess.run(
        [sys.executable, '-m', 'ruff', 'check', '--output-format', 'concise', *TARGETS],
        capture_output=True, text=True, cwd=ROOT)
    lines = [l for l in (proc.stdout + proc.stderr).splitlines()
             if l.strip() and 'All checks passed' not in l]
    return [l.replace(ROOT + os.sep, '') for l in lines]


def test_no_undefined_names():
    findings = _run_ruff()
    fatal = [f for f in findings if any(c in f for c in FATAL_CODES)]
    assert not fatal, (
        'ruff found name errors that Python will only raise at runtime:\n  '
        + '\n  '.join(fatal))


def test_lint_is_clean():
    findings = _run_ruff()
    assert not findings, (
        'ruff reported %d issue(s):\n  ' % len(findings) + '\n  '.join(findings))


def test_every_core_alias_resolves():
    import importlib
    import re

    src = open(os.path.join(ROOT, 'app.py'), encoding='utf-8').read()
    mods = dict(re.findall(r'^from core import (\w+) as (_\w+)$', src, re.M))
    mods = {alias: name for name, alias in mods.items()}

    broken = []
    for name, alias, attr in re.findall(r'^(\w+)\s*=\s*(_\w+)\.(\w+)$', src, re.M):
        if alias not in mods:
            continue
        module = importlib.import_module('core.' + mods[alias])
        if not hasattr(module, attr):
            broken.append('%s = %s.%s  (core.%s has no %s)'
                          % (name, alias, attr, mods[alias], attr))
    assert not broken, 'app.py aliases that do not resolve:\n  ' + '\n  '.join(broken)
