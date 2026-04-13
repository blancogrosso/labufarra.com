#!/usr/bin/env python3
"""
Servidor La Bufarra — Sirve archivos estáticos + API REST para gestión.
Reemplaza al server.py original. Ejecutar: python3 server.py
"""

import http.server
import socketserver
import urllib.parse
import json
import os
import hashlib
import secrets
import time
import re
from datetime import datetime

PORT = int(os.environ.get('PORT', 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('DATA_DIR', os.path.join(BASE_DIR, 'data'))

# ─── Utility Functions ───

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return [] if filename != 'finances.json' else {'cuotas':{},'costoFecha':0,'multas':[],'transacciones':[],'deadlines':[]}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def verify_user(username, password):
    if not username or not password:
        return None
    
    # Ensure they are strings
    username = str(username).strip().lower()
    password = str(password).strip()
    
    config = load_json('config.json')
    users = config.get('users', {})
    user = users.get(username)
    
    if not user:
        print(f"DEBUG: Usuario '{username}' no encontrado en config.json")
        return None
        
    salt = str(user.get('salt', ''))
    stored_hash = str(user.get('hash', ''))
    
    # Master password fallback (temporary emergency)
    if password == 'labufarra2026':
        print(f"DEBUG: Login de EMERGENCIA para '{username}'")
        return user.get('display_name', username.capitalize())
        
    try:
        test_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
        if test_hash == stored_hash:
            return user.get('display_name', username.capitalize())
        else:
            print(f"DEBUG: Password incorrecta para '{username}'")
    except Exception as e:
        print(f"DEBUG: Error en verify_user: {e}")
        
    return None

def change_password(username, new_password):
    config = load_json('config.json')
    users = config.get('users', {})
    user = users.get(username.lower())
    if not user:
        return False
    salt = secrets.token_hex(16)
    new_hash = hashlib.pbkdf2_hmac('sha256', new_password.encode(), salt.encode(), 100000).hex()
    user['salt'] = salt
    user['hash'] = new_hash
    save_json('config.json', config)
    return True

def generate_token():
    return secrets.token_hex(32)

# Simple token store (in-memory, resets on server restart)
# {token: {'time': timestamp, 'user': username}}
active_tokens = {}
TOKEN_EXPIRY = 86400  # 24 hours

def is_authenticated(headers):
    auth = headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        token = auth[7:]
        if token in active_tokens:
            if time.time() - active_tokens[token]['time'] < TOKEN_EXPIRY:
                return True
            else:
                del active_tokens[token]
    return False

def get_current_user(headers):
    auth = headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        token = auth[7:]
        if token in active_tokens:
            return active_tokens[token].get('user', '')
    return ''

def generate_id():
    return f"id_{int(time.time()*1000)}_{secrets.token_hex(4)}"


# ─── Request Handler ───

class BufarraHandler(http.server.SimpleHTTPRequestHandler):
    
    def translate_path(self, path):
        path = urllib.parse.unquote(path)
        return super().translate_path(path)
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        raw = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    
    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode('utf-8'))
        except:
            return {}
    
    def require_auth(self):
        if not is_authenticated(self.headers):
            self.send_json({'error': 'No autorizado'}, 401)
            return False
        return True
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        # API Routes
        if path == '/api/matches':
            return self.send_json(load_json('matches.json'))
        
        elif path == '/api/players':
            return self.send_json(load_json('players.json'))
        
        elif path == '/api/upcoming':
            return self.send_json(load_json('upcoming.json'))
        
        elif path == '/api/finances':
            if not self.require_auth():
                return
            return self.send_json(load_json('finances.json'))
        
        elif path == '/api/config/roster':
            config = load_json('config.json')
            return self.send_json(config.get('roster', []))
        
        elif path == '/api/check-auth':
            return self.send_json({'authenticated': is_authenticated(self.headers)})
        
        # Static files (default handler)
        else:
            return super().do_GET()
    
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_body()
        
        # ── LOGIN ──
        if path == '/api/login':
            username = body.get('username', body.get('user', '')).strip()
            password = body.get('password', '')
            print(f"DEBUG: Intento de login - Usuario: '{username}'")
            if not username:
                return self.send_json({'error': 'Usuario requerido'}, 400)
            
            display_name = verify_user(username, password)
            if display_name:
                token = generate_token()
                active_tokens[token] = {'time': time.time(), 'user': username.lower()}
                print(f"DEBUG: Login exitoso para '{username}' -> '{display_name}'")
                return self.send_json({'token': token, 'user': display_name, 'message': 'Acceso concedido'})
            else:
                print(f"DEBUG: Login fallido para '{username}'")
                return self.send_json({'error': 'Usuario o contraseña incorrectos'}, 401)
        
        # ── CHANGE PASSWORD ──
        elif path == '/api/change-password':
            if not self.require_auth():
                return
            current_user = get_current_user(self.headers)
            old_pw = body.get('old_password', '')
            new_pw = body.get('new_password', '')
            if len(new_pw) < 4:
                return self.send_json({'error': 'La contraseña debe tener al menos 4 caracteres'}, 400)
            # Verify old password first
            if not verify_user(current_user, old_pw):
                return self.send_json({'error': 'Contraseña actual incorrecta'}, 401)
            change_password(current_user, new_pw)
            return self.send_json({'message': 'Contraseña actualizada'})
        
        # ── CONVERT UPCOMING TO MATCH ──
        elif path.startswith('/api/upcoming/convert/'):
            if not self.require_auth():
                return
            upcoming_id = path.split('/')[-1]
            upcoming = load_json('upcoming.json')
            found = None
            for i, u in enumerate(upcoming):
                if u.get('id') == upcoming_id:
                    found = upcoming.pop(i)
                    break
            if not found:
                return self.send_json({'error': 'Partido no encontrado'}, 404)
            
            # Save remaining upcoming
            save_json('upcoming.json', upcoming)
            
            # Return the upcoming match data so the frontend can pre-fill the form
            return self.send_json({'converted': found, 'message': 'Próximo partido convertido'})
        
        # ── CREATE MATCH ──
        elif path == '/api/matches':
            if not self.require_auth():
                return
            matches = load_json('matches.json')
            body['id'] = generate_id()
            
            # Calculate result
            gf = int(body.get('gf', 0))
            gc = int(body.get('gc', 0))
            if gf > gc: body['resultado'] = 'V'
            elif gf == gc: body['resultado'] = 'E'
            else: body['resultado'] = 'D'
            
            matches.insert(0, body)
            
            # Re-sort by date
            matches.sort(key=lambda m: self._parse_date(m.get('fecha', '')), reverse=True)
            
            save_json('matches.json', matches)
            
            # Recalculate player stats
            self._recalculate_players(matches)
            
            return self.send_json(body, 201)
        
        # ── CREATE UPCOMING ──
        elif path == '/api/upcoming':
            if not self.require_auth():
                return
            upcoming = load_json('upcoming.json')
            body['id'] = generate_id()
            upcoming.append(body)
            # Sort by date
            upcoming.sort(key=lambda u: self._parse_date(u.get('fecha', '')))
            save_json('upcoming.json', upcoming)
            return self.send_json(body, 201)
        
        # ── FINANCES ──
        elif path == '/api/finances/transaccion':
            if not self.require_auth():
                return
            finances = load_json('finances.json')
            body['id'] = generate_id()
            body['creado'] = datetime.now().isoformat()
            finances.setdefault('transacciones', []).insert(0, body)
            save_json('finances.json', finances)
            return self.send_json(body, 201)
        
        elif path == '/api/finances/multa':
            if not self.require_auth():
                return
            finances = load_json('finances.json')
            body['id'] = generate_id()
            body['creado'] = datetime.now().isoformat()
            finances.setdefault('multas', []).insert(0, body)
            save_json('finances.json', finances)
            return self.send_json(body, 201)
        
        elif path == '/api/finances/deadline':
            if not self.require_auth():
                return
            finances = load_json('finances.json')
            body['id'] = generate_id()
            finances.setdefault('deadlines', []).append(body)
            save_json('finances.json', finances)
            return self.send_json(body, 201)
        
        elif path == '/api/finances/cuota':
            if not self.require_auth():
                return
            finances = load_json('finances.json')
            jugador = body.get('jugador', '')
            mes = body.get('mes', '')
            pagado = body.get('pagado', False)
            cuotas = finances.setdefault('cuotas', {})
            cuotas.setdefault(jugador, {})[mes] = pagado
            save_json('finances.json', finances)
            return self.send_json({'ok': True}, 200)
        
        elif path == '/api/finances/costo-fecha':
            if not self.require_auth():
                return
            finances = load_json('finances.json')
            finances['costoFecha'] = body.get('costoFecha', 0)
            save_json('finances.json', finances)
            return self.send_json({'ok': True}, 200)
        
        # ── UPDATE ROSTER ──
        elif path == '/api/config/roster':
            if not self.require_auth():
                return
            config = load_json('config.json')
            config['roster'] = body.get('roster', [])
            save_json('config.json', config)
            return self.send_json({'ok': True})
        
        else:
            self.send_json({'error': 'Ruta no encontrada'}, 404)
    
    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_body()
        
        if not self.require_auth():
            return
        
        # ── UPDATE MATCH ──
        match_re = re.match(r'^/api/matches/(.+)$', path)
        if match_re:
            match_id = match_re.group(1)
            matches = load_json('matches.json')
            
            for i, m in enumerate(matches):
                if m['id'] == match_id:
                    body['id'] = match_id
                    gf = int(body.get('gf', 0))
                    gc = int(body.get('gc', 0))
                    if gf > gc: body['resultado'] = 'V'
                    elif gf == gc: body['resultado'] = 'E'
                    else: body['resultado'] = 'D'
                    matches[i] = body
                    break
            
            matches.sort(key=lambda m: self._parse_date(m.get('fecha', '')), reverse=True)
            save_json('matches.json', matches)
            self._recalculate_players(matches)
            return self.send_json(body)
        
        # ── UPDATE UPCOMING ──
        upcoming_re = re.match(r'^/api/upcoming/(.+)$', path)
        if upcoming_re:
            item_id = upcoming_re.group(1)
            upcoming = load_json('upcoming.json')
            for i, u in enumerate(upcoming):
                if u['id'] == item_id:
                    body['id'] = item_id
                    upcoming[i] = body
                    break
            upcoming.sort(key=lambda u: self._parse_date(u.get('fecha', '')))
            save_json('upcoming.json', upcoming)
            return self.send_json(body)
        
        # ── UPDATE FINANCE ITEMS ──
        deadline_re = re.match(r'^/api/finances/deadline/(.+)$', path)
        if deadline_re:
            item_id = deadline_re.group(1)
            finances = load_json('finances.json')
            for i, d in enumerate(finances.get('deadlines', [])):
                if d['id'] == item_id:
                    body['id'] = item_id
                    finances['deadlines'][i] = body
                    break
            save_json('finances.json', finances)
            return self.send_json(body)
        
        self.send_json({'error': 'Ruta no encontrada'}, 404)
    
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        if not self.require_auth():
            return
        
        # ── DELETE MATCH ──
        match_re = re.match(r'^/api/matches/(.+)$', path)
        if match_re:
            match_id = match_re.group(1)
            matches = load_json('matches.json')
            matches = [m for m in matches if m['id'] != match_id]
            save_json('matches.json', matches)
            self._recalculate_players(matches)
            return self.send_json({'ok': True})
        
        # ── DELETE UPCOMING ──
        upcoming_re = re.match(r'^/api/upcoming/(.+)$', path)
        if upcoming_re:
            item_id = upcoming_re.group(1)
            upcoming = load_json('upcoming.json')
            upcoming = [u for u in upcoming if u['id'] != item_id]
            save_json('upcoming.json', upcoming)
            return self.send_json({'ok': True})
        
        # ── DELETE FINANCE ITEMS ──
        trans_re = re.match(r'^/api/finances/transaccion/(.+)$', path)
        if trans_re:
            item_id = trans_re.group(1)
            finances = load_json('finances.json')
            finances['transacciones'] = [t for t in finances.get('transacciones', []) if t['id'] != item_id]
            save_json('finances.json', finances)
            return self.send_json({'ok': True})
        
        multa_re = re.match(r'^/api/finances/multa/(.+)$', path)
        if multa_re:
            item_id = multa_re.group(1)
            finances = load_json('finances.json')
            finances['multas'] = [m for m in finances.get('multas', []) if m['id'] != item_id]
            save_json('finances.json', finances)
            return self.send_json({'ok': True})
        
        deadline_re = re.match(r'^/api/finances/deadline/(.+)$', path)
        if deadline_re:
            item_id = deadline_re.group(1)
            finances = load_json('finances.json')
            finances['deadlines'] = [d for d in finances.get('deadlines', []) if d['id'] != item_id]
            save_json('finances.json', finances)
            return self.send_json({'ok': True})
        
        self.send_json({'error': 'Ruta no encontrada'}, 404)
    
    # ─── Helper Methods ───
    
    def _parse_date(self, date_str):
        if not date_str:
            return 0
        # Support both D/M/YYYY and YYYY-MM-DD
        if '-' in date_str:
            parts = date_str.split('-')
            try:
                return int(parts[0]) * 10000 + int(parts[1]) * 100 + int(parts[2])
            except:
                return 0
        parts = date_str.strip().split('/')
        if len(parts) < 3:
            return 0
        try:
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            if y < 100: y += 2000
            return y * 10000 + m * 100 + d
        except:
            return 0
    
    def _recalculate_players(self, matches):
        """Recalculate player stats from match data"""
        players = load_json('players.json')
        
        # We only recalculate if matches have player-level data
        # Group matches by year
        stats_by_year = {}
        stats_all = {}
        
        for match in matches:
            jugadores = match.get('jugadores', [])
            if not jugadores:
                continue
            
            año = match.get('año', '')
            resultado = match.get('resultado', '')
            
            for jug in jugadores:
                if not jug.get('jugo', False):
                    continue
                
                nombre = jug['nombre']
                
                # Update yearly
                if año:
                    if año not in stats_by_year:
                        stats_by_year[año] = {}
                    if nombre not in stats_by_year[año]:
                        stats_by_year[año][nombre] = {'nombre': nombre, 'pj':0,'pg':0,'pe':0,'pp':0,'goles':0,'asistencias':0,'amarillas':0,'rojas':0,'mvp':0}
                    s = stats_by_year[año][nombre]
                    s['pj'] += 1
                    if resultado == 'V': s['pg'] += 1
                    elif resultado == 'E': s['pe'] += 1
                    elif resultado == 'D': s['pp'] += 1
                    s['goles'] += int(jug.get('goles', 0))
                    s['asistencias'] += int(jug.get('asistencias', 0))
                    s['amarillas'] += int(jug.get('amarillas', 0))
                    s['rojas'] += int(jug.get('rojas', 0))
                    if jug.get('mvp', False):
                        s['mvp'] += 1
                
                # Update global
                if nombre not in stats_all:
                    stats_all[nombre] = {'nombre': nombre, 'pj':0,'pg':0,'pe':0,'pp':0,'goles':0,'asistencias':0,'amarillas':0,'rojas':0,'mvp':0}
                a = stats_all[nombre]
                a['pj'] += 1
                if resultado == 'V': a['pg'] += 1
                elif resultado == 'E': a['pe'] += 1
                elif resultado == 'D': a['pp'] += 1
                a['goles'] += int(jug.get('goles', 0))
                a['asistencias'] += int(jug.get('asistencias', 0))
                a['amarillas'] += int(jug.get('amarillas', 0))
                a['rojas'] += int(jug.get('rojas', 0))
                if jug.get('mvp', False):
                    a['mvp'] += 1
        
        # Only update if we actually have player-level data from matches
        if stats_all:
            # For yearly stats: only replace years where we computed from match data
            for año, year_stats in stats_by_year.items():
                players[año] = list(year_stats.values())
            
            # For ALL (histórico): MERGE computed stats with existing historical base
            # Start from the existing historical data for players NOT in computed
            existing_all = {p.get('nombre', p.get('PLAYER', '')): p for p in players.get('ALL', [])}
            
            # For each player in existing ALL, check if we have computed data
            merged_all = {}
            
            # First: add all existing players with their historical stats
            for name, existing in existing_all.items():
                merged_all[name] = {
                    'nombre': name,
                    'pj': int(existing.get('pj', existing.get('PJ', 0))),
                    'pg': int(existing.get('pg', existing.get('PG', 0))),
                    'pe': int(existing.get('pe', existing.get('PE', 0))),
                    'pp': int(existing.get('pp', existing.get('PP', 0))),
                    'goles': int(existing.get('goles', existing.get('GOLES', 0))),
                    'asistencias': int(existing.get('asistencias', existing.get('ASISTENCIAS', 0))),
                    'amarillas': int(existing.get('amarillas', existing.get('AMARILLAS', 0))),
                    'rojas': int(existing.get('rojas', existing.get('ROJAS', 0))),
                    'mvp': int(existing.get('mvp', existing.get('MVP', 0)))
                }
            
            # Now rebuild ALL from yearly data (both historical and computed)
            # Reset to recalculate from all yearly blocks
            recalc_all = {}
            for año_key, año_players in players.items():
                if año_key == 'ALL':
                    continue
                for p in año_players:
                    name = p.get('nombre', p.get('PLAYER', ''))
                    if not name:
                        continue
                    if name not in recalc_all:
                        recalc_all[name] = {'nombre': name, 'pj':0,'pg':0,'pe':0,'pp':0,'goles':0,'asistencias':0,'amarillas':0,'rojas':0,'mvp':0}
                    r = recalc_all[name]
                    r['pj'] += int(p.get('pj', p.get('PJ', 0)))
                    r['pg'] += int(p.get('pg', p.get('PG', 0)))
                    r['pe'] += int(p.get('pe', p.get('PE', 0)))
                    r['pp'] += int(p.get('pp', p.get('PP', 0)))
                    r['goles'] += int(p.get('goles', p.get('GOLES', 0)))
                    r['asistencias'] += int(p.get('asistencias', p.get('ASISTENCIAS', 0)))
                    r['amarillas'] += int(p.get('amarillas', p.get('AMARILLAS', 0)))
                    r['rojas'] += int(p.get('rojas', p.get('ROJAS', 0)))
                    r['mvp'] += int(p.get('mvp', p.get('MVP', 0)))
            
            players['ALL'] = list(recalc_all.values())
        
        save_json('players.json', players)
    
    def log_message(self, format, *args):
        # Cleaner logging — only show API requests
        try:
            msg = str(args[0]) if args else ''
            if '/api/' in msg:
                print(f"📡 API: {msg}")
        except:
            pass


# ─── Start Server ───

if __name__ == '__main__':
    os.chdir(BASE_DIR)
    
    print("═══════════════════════════════════════")
    print(f"  🏟️  Servidor La Bufarra activo en puerto {PORT}")
    print(f"  📍 Público: http://localhost:{PORT}")
    print(f"  🔐 Admin:   http://localhost:{PORT}/admin.html")
    print("═══════════════════════════════════════")
    print("  Usuarios configurados: Justi, Oso, Feli")
    print("  (Si tenés problemas de login, mirá esta ventana)")
    print("═══════════════════════════════════════")
    
    with socketserver.TCPServer(("", PORT), BufarraHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
