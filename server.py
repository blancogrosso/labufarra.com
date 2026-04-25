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
import csv
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

    def _get_coach(self, year, tournament):
        y = str(year)
        t = str(tournament).lower()
        if y in ['2021', '2022']: return "Federico Dobal"
        if y == '2023':
            if 'apertura' in t: return "Federico Dobal"
            if 'intermedio' in t: return "Sebastian Pedemonte / Justiniano Molina"
            if 'campeones' in t: return "Santiago Mateo"
            return "Federico Dobal"
        if y == '2024': return "Guillermo Rodriguez"
        if y == '2025': return "Emiliano Reyes"
        if y == '2026': return "Santiago Mateo / Emiliano Reyes"
        return ""

    def _sync_to_csv(self, matches):
        """Generates 3 CSV files in DATOS EXCEL for Google Sheets sync"""
        excel_dir = os.path.join(BASE_DIR, 'DATOS EXCEL')
        os.makedirs(excel_dir, exist_ok=True)
        
        # 1. BUFARRA ESTADISTICAS - PARTIDOS.csv
        p_path = os.path.join(excel_dir, 'BUFARRA ESTADISTICAS - PARTIDOS.csv')
        headers_p = ["Año", "Fecha", "Torneo", "Instancia", "Rival", "GF", "GC", "Resultado", "Lugar", "Director Técnico"]
        with open(p_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers_p)
            for m in matches:
                writer.writerow([
                    m.get('año', ''), m.get('fecha', ''), m.get('torneo', ''), m.get('instancia', ''),
                    m.get('vs', m.get('rival', '')), m.get('gf', ''), m.get('gc', ''), m.get('resultado', ''),
                    m.get('lugar', ''), self._get_coach(m.get('año', ''), m.get('torneo', ''))
                ])

        # 2. BUFARRA ESTADISTICAS - DETALLE.csv (Granular)
        d_path = os.path.join(excel_dir, 'BUFARRA ESTADISTICAS - DETALLE.csv')
        headers_d = ["MatchID", "Año", "Torneo", "Fecha", "Jugador", "Goles", "Asistencias", "Amarillas", "Rojas", "MVP", "Rival"]
        with open(d_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers_d)
            for m in matches:
                for j in m.get('jugadores', []):
                    if not j.get('jugo', False): continue
                    writer.writerow([
                        m.get('id', ''), m.get('año', ''), m.get('torneo', ''), m.get('fecha', ''),
                        j['nombre'], j.get('goles', 0), j.get('asistencias', 0), j.get('amarillas', 0), j.get('rojas', 0),
                        "SI" if j.get('mvp') else "NO", m.get('vs', m.get('rival', ''))
                    ])

        # 3. BUFARRA ESTADISTICAS - JUGADORES.csv (Aggregated by Year-Tournament)
        players = load_json('players.json')
        s_path = os.path.join(excel_dir, 'BUFARRA ESTADISTICAS - JUGADORES.csv')
        headers_s = ["Sección", "Año", "Torneo", "Director Técnico", "Jugador", "PJ", "PG", "PE", "PP", "Goles", "Asistencias", "Amarillas", "Rojas", "MVP"]
        with open(s_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers_s)
            
            # Global Historical Block
            for p in players.get('ALL', []):
                writer.writerow([
                    "HISTÓRICO", "TOTAL", "-", p.get('nombre', ''),
                    p.get('pj', 0), p.get('pg', 0), p.get('pe', 0), p.get('pp', 0),
                    p.get('goles', 0), p.get('asistencias', 0), p.get('amarillas', 0), p.get('rojas', 0), p.get('mvp', 0)
                ])
                
            # Yearly Blocks
            for year, tournaments in players.items():
                if year == 'ALL': continue
                if isinstance(tournaments, dict):
                    for t_name, t_data in tournaments.items():
                        dt = t_data.get('dt', self._get_coach(year, t_name))
                        for p in t_data.get('jugadores', []):
                            writer.writerow([
                                year, t_name, dt, p.get('nombre', ''),
                                p.get('pj', 0), p.get('pg', 0), p.get('pe', 0), p.get('pp', 0),
                                p.get('goles', 0), p.get('asistencias', 0), p.get('amarillas', 0), p.get('rojas', 0), p.get('mvp', 0)
                            ])
    
    def normalize_name(self, name):
        """Standardize names to prevent duplicates due to accents/casing"""
        import unicodedata
        if not name: return ""
        n = name.strip()
        # Specific visual mappings for consistent grouping
        mapping = {
            "Martínez": "Martinez",
            "Miqueas Martinez": "Martinez",
            "Enzo De León": "De León",
            "Rodríguez": "Rodriguez",
            "Guillermo Rodriguez": "Rodriguez",
            "Joaquin Valle": "Valle",
            "Mateo": "Mateo",
            "Santiago Mateo": "Mateo",
            "da Silveira": "Da Silveira",
            "Silva, Gastón": "Silva, Gaston"
        }
        if n in mapping: return mapping[n]
        
        # General accent stripping for safety
        normalized = unicodedata.normalize('NFD', n)
        return "".join(c for c in normalized if unicodedata.category(c) != 'Mn')

    def _recalculate_players(self, matches):
        """Recalculate player stats with complete Yearly Master, Year > Tournament granularity and Normalization"""
        # Load the Yearly Master (2021-2025)
        players_db = load_json('historical_master.json')
        if not isinstance(players_db, dict): players_db = {}

        # Add new matches to the database
        for match in matches:
            jugadores = match.get('jugadores', [])
            if not jugadores: continue
            
            año = str(match.get('año', ''))
            torneo = match.get('torneo', 'Otros')
            resultado = match.get('resultado', '')
            
            if año not in players_db: players_db[año] = {}
            if torneo not in players_db[año]:
                players_db[año][torneo] = {
                    "dt": self._get_coach(año, torneo),
                    "jugadores_map": {}
                }
            
            t_block = players_db[año][torneo]
            if "jugadores" in t_block and "jugadores_map" not in t_block:
                t_block["jugadores_map"] = { self.normalize_name(p['nombre']): p for p in t_block["jugadores"] }
                del t_block["jugadores"]
            
            t_map = t_block["jugadores_map"]
            
            for jug in jugadores:
                if not jug.get('jugo', False): continue
                nombre_raw = jug['nombre']
                nombre = self.normalize_name(nombre_raw)
                
                if nombre not in t_map:
                    t_map[nombre] = {'nombre': nombre, 'pj':0,'pg':0,'pe':0,'pp':0,'goles':0,'asistencias':0,'amarillas':0,'rojas':0,'mvp':0}
                
                s = t_map[nombre]
                s['pj'] += 1
                if resultado == 'V': s['pg'] += 1
                elif resultado == 'E': s['pe'] += 1
                elif resultado == 'D': s['pp'] += 1
                s['goles'] += int(jug.get('goles', 0))
                s['asistencias'] += int(jug.get('asistencias', 0))
                s['amarillas'] += int(jug.get('amarillas', 0))
                s['rojas'] += int(jug.get('rojas', 0))
                if jug.get('mvp', False): s['mvp'] += 1

        # Flatten yearly data and calculate Global ALL
        stats_all = {}
        final_players = {"ALL": []}
        
        for year in sorted(players_db.keys()):
            final_players[year] = {}
            for t_name, t_data in players_db[year].items():
                list_players = list(t_data.get("jugadores_map", {}).values()) if "jugadores_map" in t_data else t_data.get("jugadores", [])
                
                # Update ALL
                for p in list_players:
                    name = self.normalize_name(p['nombre'])
                    if name not in stats_all:
                        stats_all[name] = {'nombre': name, 'pj':0,'pg':0,'pe':0,'pp':0,'goles':0,'asistencias':0,'amarillas':0,'rojas':0,'mvp':0}
                    
                    target = stats_all[name]
                    target['pj'] += p.get('pj', 0)
                    target['pg'] += p.get('pg', 0)
                    target['pe'] += p.get('pe', 0)
                    target['pp'] += p.get('pp', 0)
                    target['goles'] += p.get('goles', 0)
                    target['asistencias'] += p.get('asistencias', 0)
                    target['amarillas'] += p.get('amarillas', 0)
                    target['rojas'] += p.get('rojas', 0)
                    target['mvp'] += p.get('mvp', 0)

                final_players[year][t_name] = {
                    "dt": t_data.get("dt", self._get_coach(year, t_name)),
                    "jugadores": list_players
                }

        final_players["ALL"] = list(stats_all.values())
        save_json('players.json', final_players)
        self._sync_to_csv(matches)
    
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
