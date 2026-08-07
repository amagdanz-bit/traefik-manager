import json
import random
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

random.seed(11)
NOW = int(time.time())

SCENARIOS = [
    ('crowdsecurity/http-cve-probing-detection', 'leaky', 10, '10s'),
    ('crowdsecurity/http-sensitive-files-and-dirs-probing', 'leaky', 15, '10s'),
    ('LePresidente/http-generic-403-bf', 'leaky', 20, '30s'),
    ('crowdsecurity/http-crawl-non_statics', 'leaky', 40, '10s'),
    ('crowdsecurity/CVE-2021-41773', 'trigger', 0, '0'),
    ('crowdsecurity/ssh-bf', 'leaky', 5, '10s'),
]

SOURCES = [
    ('45.148.10.125', 'NL', 'AS49453', 'Global Layer B.V.'),
    ('185.220.101.42', 'DE', 'AS205100', 'F3 Netze e.V.'),
    ('141.98.11.60', 'LT', 'AS209605', 'UAB Host Baltic'),
    ('92.63.197.14', 'RU', 'AS48282', 'Vpsville LLC'),
    ('167.94.138.34', 'US', 'AS398324', 'Censys, Inc.'),
    ('205.210.31.72', 'US', 'AS6939', 'Hurricane Electric'),
    ('20.169.44.9', 'IE', 'AS8075', 'Microsoft Corporation'),
    ('43.163.213.9', 'SG', 'AS132203', 'Tencent Building'),
]

PATHS = ['/.env', '/wp-login.php', '/admin/config.php', '/.git/config', '/api/v1/login',
         '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php', '/actuator/health', '/xmlrpc.php']
AGENTS = ['curl/8.5.0', 'Mozilla/5.0 (compatible; CensysInspect/1.1)', 'python-requests/2.31.0',
          'masscan/1.3', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Go-http-client/2.0', 'zgrab/0.x']
VERBS = ['GET', 'GET', 'GET', 'POST', 'HEAD']

ALERTS = []
for i in range(1, 231):
    ip, cn, asn, as_name = SOURCES[i % len(SOURCES)]
    scen, kind, cap, leak = SCENARIOS[i % len(SCENARIOS)]
    t = NOW - random.randint(60, 6 * 3600)
    stamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(t))
    meta = [
        {'key': 'target_uri', 'value': PATHS[i % len(PATHS)]},
        {'key': 'http_verb', 'value': VERBS[i % len(VERBS)]},
        {'key': 'user_agent', 'value': AGENTS[i % len(AGENTS)]},
        {'key': 'http_status', 'value': random.choice(['404', '403', '200', '401'])},
    ]
    ALERTS.append({
        'id': i,
        'uuid': '%08x-0000-4000-8000-%012x' % (i, i),
        'scenario': scen,
        'scenario_version': '0.4',
        'events_count': random.randint(6, 240),
        'capacity': cap,
        'leakspeed': leak,
        'simulated': i % 47 == 0,
        'remediation': i % 3 != 0,
        'start_at': stamp,
        'stop_at': stamp,
        'created_at': stamp,
        'machine_id': 'edge-01',
        'message': 'Ip %s performed %s' % (ip, scen),
        'source': {'ip': ip, 'value': ip, 'scope': 'Ip', 'cn': cn,
                   'as_number': asn, 'as_name': as_name, 'range': ip.rsplit('.', 1)[0] + '.0/24'},
        'meta': meta,
        'events': [{'timestamp': stamp, 'meta': meta}],
        'decisions': [],
    })

DECISIONS = []
_id = 1
for ip, cn, asn, as_name in SOURCES[:5]:
    DECISIONS.append({'id': _id, 'origin': 'crowdsec', 'value': ip, 'type': 'ban', 'scope': 'Ip',
                      'scenario': SCENARIOS[_id % len(SCENARIOS)][0], 'duration': '3h47m12s'})
    _id += 1
DECISIONS.append({'id': _id, 'origin': 'cscli', 'value': '203.0.113.44', 'type': 'ban', 'scope': 'Ip',
                  'scenario': 'manual ban from Traefik Manager', 'duration': '23h11m04s'})
_id += 1
DECISIONS.append({'id': _id, 'origin': 'cscli', 'value': '198.51.100.0/24', 'type': 'captcha', 'scope': 'Range',
                  'scenario': 'suspicious range', 'duration': '71h02m48s'})
_id += 1
for i in range(_id, _id + 41000):
    DECISIONS.append({'id': i, 'origin': 'CAPI', 'value': '10.%d.%d.%d' % (i // 65536 % 256, i // 256 % 256, i % 256),
                      'type': 'ban', 'scope': 'Ip', 'scenario': 'crowdsecurity/community-blocklist',
                      'duration': '164h12m03s'})


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/v1/decisions':
            from urllib.parse import parse_qs
            q = parse_qs(u.query)
            limit = int(q.get('limit', ['100'])[0])
            idg = int(q.get('id_gt', ['0'])[0])
            self._send([d for d in DECISIONS if d['id'] > idg][:limit])
        elif u.path == '/v1/alerts':
            self._send(ALERTS)
        else:
            self._send([])

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        self.rfile.read(n)
        self._send({'code': 200, 'token': 'stub', 'expire': '2099-01-01T00:00:00Z'})


HTTPServer(('0.0.0.0', 8098), H).serve_forever()
