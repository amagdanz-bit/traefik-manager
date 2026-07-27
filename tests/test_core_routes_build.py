"""Tests for core.routes_build.

These builders turn a parsed config into the route objects the UI and the mobile
app render, and the merge helpers write them back. The same code serves the Host
and remote agents, so a regression here shows up everywhere at once.
"""
from core import routes_build as rb


HTTP_CONFIG = {
    'http': {
        'routers': {
            'app1': {
                'rule': 'Host(`app1.example.com`)',
                'service': 'app1-service',
                'entryPoints': ['websecure'],
                'middlewares': ['auth@file'],
                'tls': {'certResolver': 'letsencrypt'},
                'priority': 42,
            },
        },
        'services': {
            'app1-service': {
                'loadBalancer': {
                    'servers': [{'url': 'http://10.0.0.1:8080'},
                                {'url': 'http://10.0.0.2:8080'}],
                    'sticky': {'cookie': {'name': 'tm_sticky', 'secure': True}},
                    'healthCheck': {'path': '/health', 'interval': '10s'},
                },
            },
        },
    },
}


def _first(cfg=HTTP_CONFIG):
    apps = rb._build_apps(cfg, '', {}, {}, {})
    assert apps, 'no routes built'
    return apps[0]


def test_build_apps_reads_the_router_and_service():
    a = _first()
    assert a['name'] == 'app1'
    assert a['protocol'] == 'http'
    assert a['rule'] == 'Host(`app1.example.com`)'
    assert a['target'] == 'http://10.0.0.1:8080'
    assert a['certResolver'] == 'letsencrypt'
    assert a['tls'] is True


def test_build_apps_surfaces_all_backends():
    a = _first()
    assert a['servers'] == ['http://10.0.0.1:8080', 'http://10.0.0.2:8080']
    assert a['target'] == a['servers'][0], 'target must stay servers[0] for older clients'


def test_build_apps_surfaces_load_balancing_settings():
    a = _first()
    assert a['sticky'].get('name') == 'tm_sticky'
    assert a['stickyEnabled'] is True
    assert a['healthCheck'].get('path') == '/health'
    assert a['priority'] == 42


def test_build_apps_on_empty_config_is_empty():
    assert rb._build_apps({}, '', {}, {}, {}) == []
    assert rb._build_apps({'http': {}}, '', {}, {}, {}) == []


def test_build_middlewares_lists_file_middlewares():
    cfg = {'http': {'middlewares': {'auth': {'basicAuth': {'users': ['a:b']}}}}}
    mws = rb._build_middlewares(cfg, '')
    assert [m['name'] for m in mws] == ['auth']
    assert mws[0]['type'] == 'http'


def test_merge_router_only_touches_managed_keys():
    """Hand-written keys on a router must survive a save."""
    existing = {'rule': 'Host(`old`)', 'service': 'svc', 'customKey': 'keep me',
                'tls': {'certResolver': 'old'}}
    routers = {'r': existing}
    rb._merge_router(routers, 'r', {'rule': 'Host(`new`)', 'service': 'svc'},
                     ('rule', 'entryPoints', 'service', 'middlewares', 'tls'))
    assert routers['r']['rule'] == 'Host(`new`)'
    assert routers['r']['customKey'] == 'keep me', 'an unmanaged key was dropped'


def test_merge_service_preserves_extra_backends_for_legacy_clients():
    """A client that does not manage backends updates only the first server."""
    services = {'s': {'loadBalancer': {
        'servers': [{'url': 'http://1.1.1.1:80'}, {'url': 'http://2.2.2.2:80'}],
        'sticky': {'cookie': {'name': 'keep'}},
    }}}
    rb._merge_service(services, 's', {'servers': [{'url': 'http://9.9.9.9:99'}]},
                      'url', '', managed_backends=False)
    lb = services['s']['loadBalancer']
    assert lb['servers'][0]['url'] == 'http://9.9.9.9:99'
    assert len(lb['servers']) == 2, 'extra backend wiped by a legacy save'
    assert lb['sticky']['cookie']['name'] == 'keep'


def test_merge_service_replaces_backends_for_managing_clients():
    services = {'s': {'loadBalancer': {
        'servers': [{'url': 'http://1.1.1.1:80'}, {'url': 'http://2.2.2.2:80'}],
        'sticky': {'cookie': {'name': 'gone'}},
    }}}
    rb._merge_service(services, 's', {'servers': [{'url': 'http://9.9.9.9:99'}]},
                      'url', '', managed_backends=True)
    lb = services['s']['loadBalancer']
    assert [s['url'] for s in lb['servers']] == ['http://9.9.9.9:99']
    assert 'sticky' not in lb, 'sticky should be cleared when the client manages it'


def test_permissions_policy_round_trip():
    perms = {f: 'self' for f in rb.HEADERS_PRESET_SELF_DEFAULT}
    value = rb._build_permissions_policy(perms)
    assert 'geolocation=(self)' in value
    decoded = rb._parse_permissions_policy(value)
    for f in rb.HEADERS_PRESET_SELF_DEFAULT:
        assert decoded.get(f) == 'self'


def test_trusted_ip_dedup_by_network():
    final, added = rb._merge_trusted_ips(['10.0.0.0/8'], ['10.5.5.5/8', '192.168.0.0/16'])
    assert '10.5.5.5/8' not in added, 'an already-covered network was re-added'
    assert '192.168.0.0/16' in added
    assert '10.0.0.0/8' in final


def test_app_aliases_point_at_core(app_module):
    assert app_module._build_apps is rb._build_apps
    assert app_module._merge_service is rb._merge_service
    assert app_module.HEADERS_PRESET_FEATURES is rb.HEADERS_PRESET_FEATURES
