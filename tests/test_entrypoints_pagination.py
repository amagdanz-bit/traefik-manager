from urllib.parse import parse_qs, urlparse

from core import traefik as traefik_mod


class _Resp:
    def __init__(self, payload, status_code=200, headers=None):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}

    def json(self):
        return self._payload


def _traefik_stub(monkeypatch, rows):
    urls = []

    def fake_get(url, **kwargs):
        urls.append(url)
        q = parse_qs(urlparse(url).query)
        per_page = int(q.get('per_page', ['100'])[0])
        page = int(q.get('page', ['1'])[0])
        start = (page - 1) * per_page
        headers = {}
        if start + per_page < len(rows):
            headers['X-Next-Page'] = str(page + 1)
        return _Resp(rows[start:start + per_page], headers=headers)

    monkeypatch.setattr(traefik_mod.requests, 'get', fake_get)
    return urls


def _entrypoints(count, secure_at=None):
    eps = [{'name': 'ep-%d' % i, 'address': ':%d' % (9000 + i)} for i in range(count)]
    if secure_at is not None:
        eps[secure_at] = {'name': 'websecure', 'address': ':443'}
    return eps


def test_a_request_without_per_page_only_sees_the_first_page(monkeypatch):
    _traefik_stub(monkeypatch, _entrypoints(250))
    got = traefik_mod.traefik_api_get('/api/entrypoints')
    assert len(got) == 100, (
        'the stub must truncate the way Traefik does, otherwise the pagination '
        'tests below would still pass with the fix reverted')


def test_entrypoints_endpoint_returns_more_than_the_first_page(client, monkeypatch):
    _traefik_stub(monkeypatch, _entrypoints(250))

    res = client.get('/api/traefik/entrypoints')
    assert res.status_code == 200, res.data
    names = [e['name'] for e in res.get_json()]
    assert len(names) == 250, (
        'the endpoint returned %d of 250 entry points. Traefik pages at 100 per '
        'request, so an instance with many entry points loses every one past the '
        'first page and the dashboard cannot show it.' % len(names))
    assert 'ep-249' in names


def test_entrypoints_request_asks_traefik_for_one_page(client, monkeypatch):
    urls = _traefik_stub(monkeypatch, _entrypoints(5))

    client.get('/api/traefik/entrypoints')
    assert urls, 'the endpoint never called the Traefik API'
    q = parse_qs(urlparse(urls[0]).query)
    assert q.get('per_page') == ['1000'], (
        '%s was fetched without per_page, so Traefik caps the answer at 100' % urls[0])


def test_best_entrypoint_sees_a_443_entry_point_past_the_first_page(monkeypatch, app_module):
    _traefik_stub(monkeypatch, _entrypoints(250, secure_at=200))

    assert app_module._best_entrypoint() == 'websecure', (
        'the HTTPS entry point sits past the first page, so the setup wizard and '
        'the self-route feature would silently pick a plain HTTP entry point')


def test_best_entrypoint_prefers_443_over_the_first_entry_point(monkeypatch, app_module):
    _traefik_stub(monkeypatch, _entrypoints(3, secure_at=2))
    assert app_module._best_entrypoint() == 'websecure'


def test_best_entrypoint_falls_back_when_traefik_is_unreachable(monkeypatch, app_module):
    monkeypatch.setattr(app_module, 'traefik_api_get_all', lambda path: None)
    assert app_module._best_entrypoint() == 'websecure'


def test_entrypoints_endpoint_reports_502_when_traefik_is_unreachable(client, monkeypatch, app_module):
    monkeypatch.setattr(app_module, 'traefik_api_get_all', lambda path: None)

    res = client.get('/api/traefik/entrypoints')
    assert res.status_code == 502
    assert 'error' in res.get_json()


def test_entrypoints_endpoint_requires_authentication(anon_client):
    assert anon_client.get('/api/traefik/entrypoints').status_code != 200


def test_traefik_api_get_all_appends_to_an_existing_query(monkeypatch):
    urls = _traefik_stub(monkeypatch, _entrypoints(5))

    traefik_mod.traefik_api_get_all('/api/http/routers?search=web')
    assert urls, 'no request was made'
    assert urls[0].count('?') == 1, (
        '%s has two question marks, which makes the query string unparseable and '
        'silently drops per_page' % urls[0])
    q = parse_qs(urlparse(urls[0]).query)
    assert q.get('search') == ['web'], "the caller's own query parameter was dropped"
    assert q.get('per_page') == ['1000']


def test_traefik_api_get_all_follows_the_next_page_header(monkeypatch):
    urls = _traefik_stub(monkeypatch, _entrypoints(2300))

    got = traefik_mod.traefik_api_get_all('/api/entrypoints')
    assert len(got) == 2300, (
        'traefik_api_get_all stopped at %d rows. Traefik answers X-Next-Page when a '
        'list is longer than per_page, so an install with more than 1000 routers '
        'silently loses everything past the first page' % len(got))
    assert got[-1]['name'] == 'ep-2299'
    assert len(urls) == 3, 'expected three pages of 1000, got %r' % urls
    assert 'page=2' in urls[1] and 'page=3' in urls[2]


def test_traefik_api_get_all_stops_when_traefik_reports_no_next_page(monkeypatch):
    urls = _traefik_stub(monkeypatch, _entrypoints(5))

    assert len(traefik_mod.traefik_api_get_all('/api/entrypoints')) == 5
    assert len(urls) == 1, 'a single short page must not trigger a second request'
    assert 'page' not in parse_qs(urlparse(urls[0]).query), (
        'the first request must not pin an explicit page number')


def test_traefik_api_get_all_keeps_a_non_list_answer_whole(monkeypatch):
    def fake_get(url, **kwargs):
        return _Resp({'http': {'routers': {'total': 3}}})

    monkeypatch.setattr(traefik_mod.requests, 'get', fake_get)
    assert traefik_mod.traefik_api_get_all('/api/overview') == {'http': {'routers': {'total': 3}}}
