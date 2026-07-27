"""Static checks that catch what the runtime tests cannot.

The v1.9.0 split removed _ALLOWED_FILE_PREFIXES from app.py while two functions
still referenced it. Python only raises on a missing global when the line
actually runs, so the app imported fine, every route registered, the whole test
suite passed - and the Logs tab failed for every Host user.

pyflakes finds that class of defect statically. Undefined names are a hard
failure; everything else it reports is treated as a failure too, because the
tree is clean today and keeping it clean is cheap.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = ['app.py', 'core', 'tests']

# pyflakes messages that are never acceptable - these are real bugs, not style
FATAL_SUBSTRINGS = (
    'undefined name',
    'local variable',           # referenced before assignment
    'redefinition of unused',   # a second def silently shadowing the first
    'is assigned to but never used',
)


def _run_pyflakes():
    paths = [os.path.join(ROOT, t) for t in TARGETS]
    proc = subprocess.run(
        [sys.executable, '-m', 'pyflakes', *paths],
        capture_output=True, text=True, cwd=ROOT)
    lines = [l for l in (proc.stdout + proc.stderr).splitlines() if l.strip()]
    return [l.replace(ROOT + os.sep, '') for l in lines]


def test_no_undefined_names():
    """The specific bug class that shipped: a name used but never defined."""
    findings = _run_pyflakes()
    fatal = [f for f in findings
             if any(s in f.lower() for s in FATAL_SUBSTRINGS)]
    assert not fatal, (
        'pyflakes found name errors that Python will only raise at runtime:\n  '
        + '\n  '.join(fatal))


def test_pyflakes_is_clean():
    """Keep the tree free of dead imports so the check above stays trustworthy.

    If this fails on something deliberate, fix the code rather than loosening
    the test - noise here is what let a real undefined name hide in the first
    place.
    """
    findings = _run_pyflakes()
    assert not findings, (
        'pyflakes reported %d issue(s):\n  ' % len(findings) + '\n  '.join(findings))
