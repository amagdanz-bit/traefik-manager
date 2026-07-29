import os
import re

CSS_PATH = os.path.join(os.path.dirname(__file__), '..', 'static', 'css', 'app.css')

PHONE_WIDTH = 360


def _strip_comments(text: str) -> str:
    return re.sub(r'/\*.*?\*/', '', text, flags=re.S)


def _rules(text: str):
    """Yield (selector, body, media) for every rule, tracking @media nesting."""
    text = _strip_comments(text)
    stack, i, n = [], 0, len(text)
    while i < n:
        brace = text.find('{', i)
        if brace == -1:
            break
        head = text[i:brace].strip()
        if head.startswith('@'):
            stack.append(head)
            i = brace + 1
            continue
        close = text.find('}', brace)
        if close == -1:
            break
        yield head, text[brace + 1:close], ' '.join(stack)
        i = close + 1
        while i < n and text[i:].lstrip().startswith('}'):
            j = text.index('}', i)
            if stack:
                stack.pop()
            i = j + 1


def _declarations(body: str, prop: str):
    for m in re.finditer(rf'(?<![\w-]){prop}\s*:\s*([^;]+)', body):
        yield m.group(1).strip()


def _hard_px_floor(value: str):
    """A floor that cannot shrink: a bare px length, not wrapped in min()/clamp()."""
    if 'min(' in value or 'clamp(' in value:
        return None
    m = re.fullmatch(r'(\d+(?:\.\d+)?)px(?:\s*!important)?', value)
    return float(m.group(1)) if m else None


def _shrinks_on_small_screens(media: str) -> bool:
    """A floor is safe if the rule only applies above a breakpoint."""
    return bool(re.search(r'min-width\s*:\s*(\d+)px', media))


def _released_selectors(css: str, prop: str):
    """Selectors that drop the floor again inside a small-screen media query."""
    out = set()
    for selector, body, media in _rules(css):
        if not re.search(r'max-width\s*:\s*\d+px', media):
            continue
        for value in _declarations(body, prop):
            if value.split()[0] in ('unset', 'auto', 'initial', 'revert', '0'):
                out.update(s.strip() for s in selector.split(','))
    return out


def _is_released(selector: str, released) -> bool:
    for part in (s.strip() for s in selector.split(',')):
        if not any(part == r or r.endswith(' ' + part) for r in released):
            return False
    return True


def _floor_offenders(css: str, prop: str):
    released = _released_selectors(css, prop)
    offenders = []
    for selector, body, media in _rules(css):
        if _shrinks_on_small_screens(media) or _is_released(selector, released):
            continue
        for value in _declarations(body, prop):
            px = _hard_px_floor(value)
            if px is not None and px >= PHONE_WIDTH:
                offenders.append(f"{selector} {{ {prop}: {value} }}"
                                 + (f"  (in {media})" if media else ""))
    return offenders


def test_no_unshrinkable_width_floors():
    """A fixed min-width wins over max-width in CSS, so a hard px floor survives
    every responsive override and forces the element wider than a phone. Clamp it
    with min(Npx, Nvw) or scope the rule to a min-width media query instead."""
    with open(CSS_PATH, encoding='utf-8') as fh:
        css = fh.read()

    offenders = _floor_offenders(css, 'min-width')
    assert not offenders, (
        "min-width overrides max-width, so these force horizontal overflow on a "
        f"{PHONE_WIDTH}px screen no matter what a media query sets:\n  "
        + "\n  ".join(offenders))


def test_no_unshrinkable_height_floors():
    """Same trap vertically: a hard min-height outgrows a landscape phone."""
    with open(CSS_PATH, encoding='utf-8') as fh:
        css = fh.read()

    offenders = _floor_offenders(css, 'min-height')
    assert not offenders, (
        "min-height overrides max-height, so these grow taller than a landscape "
        "phone regardless of any media query:\n  " + "\n  ".join(offenders))


def test_resizable_elements_declare_a_scroll_context():
    """CSS resize is ignored when overflow is visible. A resize handle that does
    nothing looks like a broken control, so pair the two."""
    with open(CSS_PATH, encoding='utf-8') as fh:
        css = fh.read()

    offenders = []
    for selector, body, media in _rules(css):
        values = [v for v in _declarations(body, 'resize')]
        if not values or all(v.split()[0] == 'none' for v in values):
            continue
        overflow = list(_declarations(body, 'overflow')) \
            + list(_declarations(body, 'overflow-x')) \
            + list(_declarations(body, 'overflow-y'))
        if not any(v.split()[0] in ('hidden', 'auto', 'scroll') for v in overflow):
            offenders.append(f"{selector} {{ resize: {values[0]} }}")

    assert not offenders, (
        "resize has no effect unless overflow is hidden, auto or scroll:\n  "
        + "\n  ".join(offenders))
