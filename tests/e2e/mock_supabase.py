"""In-memory PostgREST + storage MOCK used by the browser tests (the build sandbox cannot reach supabase.co).
It is NOT the real database: it re-implements just enough (filters, order, limit, unique keys, the stock trigger, v_yarn_stock) so UI flows can be
exercised. Real row-level security and constraints are tested separately in supabase/tests (SQL, local and on the real project)."""
import json, re, uuid, base64, urllib.parse
from collections import defaultdict
H = 'https://mlrydpclqokizsqmigen.supabase.co'
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json'}
UNIQUE = {'biz_yarns': ('business_id', 'code'), 'biz_quotations': ('business_id', 'ref'), 'biz_orders': ('business_id', 'ref')}
ENUMS = {'biz_projects': {'status': {'enquiry', 'quoted', 'confirmed', 'in_production', 'finished', 'delivered', 'cancelled'}}, 'biz_orders': {'status': {'open', 'in_production', 'ready', 'delivered', 'cancelled'}},
         'biz_quotations': {'status': {'draft', 'sent', 'accepted', 'rejected', 'expired'}}, 'yarn_movements': {'kind': {'purchase', 'estimated_use', 'actual_use', 'adjustment'}},
         'custom_designs': {'status': {'draft', 'submitted', 'approved', 'active', 'archived'}}, 'biz_yarns': {'availability': {'unknown', 'in-stock', 'low', 'out', 'discontinued'}}}
DEFAULTS = {'biz_yarns': {'stock_kg': 0, 'active': True, 'availability': 'unknown'}, 'biz_orders': {'paid': 0, 'status': 'open'}, 'biz_quotations': {'status': 'draft', 'lines': []}, 'biz_projects': {'status': 'enquiry'}, 'custom_designs': {'status': 'draft'}}
class Mock:
    def __init__(self, user='u-1', bid='b-1'):
        self.t = defaultdict(list); self.files = {}; self.log = []; self.mails = []; self.mail_status = 200; self.user = user; self.bid = bid; self.n = 0
        self.jwt = 'x.' + base64.urlsafe_b64encode(json.dumps({'sub': user, 'exp': 4102444800}).encode()).decode().rstrip('=') + '.y'
        self.t['profiles'].append({'id': user, 'email': 'rm@x.co', 'full_name': 'Rita Maker', 'role': 'customer', 'account_type': 'rugmaker', 'currency': 'LKR'})
        self.business = {'id': bid, 'name': 'Rita Tufting', 'owner_name': 'Rita', 'email': 'rm@x.co', 'phone': '', 'country': 'LK', 'currency': 'LKR', 'address': {}, 'logo_path': None, 'settings': {}}
        self.t['businesses'].append(self.business)
        self.t['business_members'].append({'business_id': bid, 'user_id': user, 'role': 'owner', 'created_at': '2026-11-01T00:00:00Z'})
        self.t['biz_rates'].append({'business_id': bid, 'rates': {}, 'updated_at': '2026-11-01T00:00:00Z'})
    def session_script(self):
        s = {'access_token': self.jwt, 'refresh_token': 'RT', 'expires_at': 4102444800, 'user': {'id': self.user, 'email': 'rm@x.co'}}
        return "localStorage.setItem('xaro_sb_session', %s);" % json.dumps(json.dumps(s))
    def rows(self, t): return self.t[t]
    def view(self):
        out = []
        for y in self.t['biz_yarns']:
            mv = [m for m in self.t['yarn_movements'] if m['yarn_id'] == y['id']]
            out.append({'id': y['id'], 'business_id': y['business_id'], 'code': y['code'], 'name': y['name'], 'hex': y['hex'], 'stock_kg': y['stock_kg'], 'reorder_kg': y.get('reorder_kg'),
                        'low_stock': y.get('reorder_kg') is not None and y['stock_kg'] <= y['reorder_kg'], 'estimated_use_kg': sum(m['kg'] for m in mv if m['kind'] == 'estimated_use'), 'actual_use_kg': sum(m['kg'] for m in mv if m['kind'] == 'actual_use')})
        return out
    def match(self, row, flt):
        for k, op, v in flt:
            x = row.get(k)
            if op == 'eq' and str(x) != v: return False
            if op == 'is' and not (x is None if v == 'null' else str(x).lower() == v): return False
            if op == 'ilike' and v.strip('*').lower() not in str(x or '').lower(): return False
            if op == 'in' and str(x) not in v.strip('()').split(','): return False
        return True
    def handle(self, route, req):
        try: return self._handle(route, req)
        except Exception as e:
            import traceback; traceback.print_exc(); route.fulfill(status=500, headers=CORS, body=json.dumps({'message': 'mock error: %s' % e}))
    def _handle(self, route, req):
        u, m = req.url, req.method; p = urllib.parse.urlparse(u); path = p.path
        if m == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
        raw = req.post_data_buffer or b''; body = raw.decode('utf-8', 'ignore') if not path.startswith('/storage/v1/object/') or 'sign' in path else ''
        self.log.append((m, path + ('?' + p.query if p.query else ''), body[:400000]))
        def ok(b, s=200, h=None): route.fulfill(status=s, headers=dict(CORS, **(h or {})), body=json.dumps(b))
        def err(code, msg, s=400): route.fulfill(status=s, headers=CORS, body=json.dumps({'code': code, 'message': msg}))
        if path.startswith('/functions/v1/send-quotation'):
            try: b = json.loads(body)
            except Exception: b = {}
            self.mails.append(b)
            if getattr(self, 'mail_status', 200) == 503: return err('not_configured', 'Email sending is not set up yet.', 503)
            q = next((x for x in self.t.get('biz_quotations', []) if x['id'] == b.get('quotationId')), None); c = q and next((x for x in self.t.get('biz_customers', []) if x['id'] == q.get('customer_id')), None)
            if not c or not c.get('email'): return err('no_customer_email', 'This customer has no valid email address.', 422)
            q['emailed_at'] = '2026-11-11T08:00:00Z'; q['emailed_to'] = c['email']; return ok({'ok': True, 'to': c['email'], 'id': 're_mock'})
        if path.startswith('/auth/v1/token') and '"password"' in body:
            try: b = json.loads(body)
            except Exception: b = {}
            if b.get('password') != 'Owner-pass-12345': return err('invalid_credentials', 'Invalid login credentials', 400)
            return ok({'access_token': self.jwt, 'refresh_token': 'RT', 'expires_in': 3600, 'user': {'id': self.user, 'email': b.get('email')}})
        if path.startswith('/auth/v1/logout'): self.signed_out = True; return ok({})
        if '/auth/v1/token' in path: return ok({'access_token': self.jwt, 'refresh_token': 'RT', 'expires_in': 3600, 'user': {'id': self.user, 'email': 'rm@x.co'}})
        if '/auth/v1/user' in path: return ok({'id': self.user, 'email': 'rm@x.co'})
        if path.startswith('/storage/v1/object/sign/'):
            return ok({'signedURL': '/object/signed/' + path.split('/sign/', 1)[1] + '?token=t'})
        if path.startswith('/storage/v1/object/signed/') or (m == 'GET' and path.startswith('/storage/v1/object/')):
            k = path.split('/object/', 1)[1].replace('signed/', '', 1).replace('authenticated/', '', 1); data = self.files.get(urllib.parse.unquote(k))
            return route.fulfill(status=200 if data else 404, headers={'access-control-allow-origin': '*', 'content-type': 'application/octet-stream'}, body=data or b'')
        if path.startswith('/storage/v1/object/') and m == 'POST':
            self.files[urllib.parse.unquote(path.split('/object/', 1)[1])] = raw; return ok({'Key': 'k'})
        if path.startswith('/storage/v1/object/') and m == 'DELETE':
            for k in json.loads(body or '{}').get('prefixes', []): [self.files.pop(f) for f in list(self.files) if f.endswith(k)]
            return ok([])
        if path.startswith('/rest/v1/rpc/'):
            fn = path.rsplit('/', 1)[1]; a = json.loads(body or '{}')
            if fn == 'add_business_member': self.t['business_members'].append({'business_id': a['p_business'], 'user_id': 'u-' + uuid.uuid4().hex[:6], 'role': a['p_role'], 'created_at': '2026-11-06T00:00:00Z'}); return ok(None)
            return err('PGRST202', 'no such function', 404)
        if not path.startswith('/rest/v1/'): return ok([])
        t = path.rsplit('/', 1)[1]; q = urllib.parse.parse_qs(p.query, keep_blank_values=True)
        flt = []
        for k, vs in q.items():
            if k in ('select', 'order', 'limit', 'offset'): continue
            for v in vs: op, _, val = v.partition('.'); flt.append((k, op, val))
        src = self.view() if t == 'v_yarn_stock' else self.t[t]
        if m == 'GET':
            res = [dict(r) for r in src if self.match(r, flt)]
            if 'order' in q:
                c, _, d = q['order'][0].partition('.'); res.sort(key=lambda r: (r.get(c) is None, r.get(c) if isinstance(r.get(c), (int, float)) else str(r.get(c) or '')), reverse=(d == 'desc'))
            if 'limit' in q: res = res[:int(q['limit'][0])]
            sel = q.get('select', [''])[0]
            if t == 'business_members' and 'businesses(' in sel:
                res = [dict(r, businesses=self.business) for r in res]
            if 'doc->_thumb' in sel: res = [dict(r, _thumb=(r.get('doc') or {}).get('_thumb')) for r in res]
            if t == 'custom_designs' and 'doc' not in sel and sel != '*':
                for r in res: r.pop('doc', None)
            return ok(res)
        if m == 'POST':
            rows = json.loads(body); rows = rows if isinstance(rows, list) else [rows]; out = []
            for r in rows:
                r = dict(DEFAULTS.get(t, {}), **r); r.setdefault('id', str(uuid.uuid4())); r.setdefault('created_at', '2026-11-06T09:00:00Z')
                if t != 'yarn_movements': r.setdefault('updated_at', r['created_at'])
                if t == 'yarn_movements': r.setdefault('at', '2026-11-06T09:00:00Z')
                if t in ('biz_orders', 'biz_quotations', 'yarn_movements'): r.setdefault('business_id', self.bid)
                if t in ('biz_orders',): r.setdefault('total', 0)
                if t == 'biz_rates' and any(x['business_id'] == r['business_id'] for x in self.t[t]): return err('23505', 'duplicate key value violates unique constraint', 409)
                for col, allowed in ENUMS.get(t, {}).items():
                    if col in r and r[col] not in allowed: return err('23514', 'violates check constraint %s' % col, 400)
                if t in UNIQUE and any(all(x.get(c) == r.get(c) for c in UNIQUE[t]) for x in self.t[t]): return err('23505', 'duplicate key value violates unique constraint', 409)
                if t == 'yarn_movements':
                    if r['kind'] == 'adjustment' and r['kg'] == 0 or r['kind'] != 'adjustment' and r['kg'] <= 0: return err('23514', 'violates check constraint', 400)
                    y = next((x for x in self.t['biz_yarns'] if x['id'] == r['yarn_id']), None)
                    if not y: return err('23503', 'violates foreign key', 409)
                    y['stock_kg'] = round(y['stock_kg'] + (r['kg'] if r['kind'] in ('purchase', 'adjustment') else -r['kg'] if r['kind'] == 'actual_use' else 0), 3)
                if t == 'custom_designs':
                    self.t['design_versions'].append({'design_id': r['id'], 'version': 1, 'doc': r['doc'], 'created_at': r['created_at']})
                self.t[t].append(r); out.append(r)
            return ok(out, 201) if 'return=representation' in (req.headers.get('prefer') or '') else route.fulfill(status=201, headers=CORS, body='')
        if m == 'PATCH':
            patch = json.loads(body); hit = [r for r in self.t[t] if self.match(r, flt)]
            for col, allowed in ENUMS.get(t, {}).items():
                if col in patch and patch[col] not in allowed: return err('23514', 'violates check constraint %s' % col, 400)
            for r in hit: r.update(patch)
            return ok(hit) if 'return=representation' in (req.headers.get('prefer') or '') else route.fulfill(status=204, headers=CORS, body='')
        if m == 'DELETE':
            self.t[t] = [r for r in self.t[t] if not self.match(r, flt)]
            if t == 'biz_yarns': self.t['yarn_movements'] = [x for x in self.t['yarn_movements'] if any(y['id'] == x['yarn_id'] for y in self.t['biz_yarns'])]
            return route.fulfill(status=204, headers=CORS, body='')
        return ok([])
    def attach(self, page):
        page.route(re.compile(r'https://mlrydpclqokizsqmigen\.supabase\.co/.*'), self.handle)
