import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRIVER = os.path.join(ROOT, 'scripts', 'test_dashboard_model.mjs')


def test_the_model_driver_ships_with_the_repo():
    assert os.path.isfile(DRIVER), (
        'scripts/test_dashboard_model.mjs is the only executable coverage the stat '
        'panel model has; without it the provider grouping, status bucketing, '
        'entry point protocol detection and overview truncation can all be '
        'reverted with the suite still green')


def test_the_dashboard_model_behaves():
    node = shutil.which('node')
    if not node:
        pytest.skip('node is not installed, run scripts/test_dashboard_model.mjs where it is')

    proc = subprocess.run([node, DRIVER], cwd=ROOT, capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, (
        'the stat panel model driver failed:\n%s\n%s' % (proc.stdout, proc.stderr))
