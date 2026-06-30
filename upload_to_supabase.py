import json
import os
import urllib.request

# Supabase Config
SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co"
SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

DATA_DIR = "data"

def upload_json(table_name, file_path, process_fn=None):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r') as f:
        data = json.load(f)
    
    if process_fn:
        data = process_fn(data)
    
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=HEADERS, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 201]:
                print(f"Successfully uploaded {len(data)} rows to {table_name}")
            else:
                print(f"Server returned status {response.status} for {table_name}")
    except Exception as e:
        print(f"Failed to upload to {table_name}: {e}")

def process_players(data):
    # data is { year: [ {nombre, pj...}, ... ] }
    rows = []
    for year, players_list in data.items():
        for stats in players_list:
            row = {
                "year": year,
                "player_name": stats.get('nombre', stats.get('PLAYER', '')),
                "pj": stats.get('pj', 0),
                "pg": stats.get('pg', 0),
                "pe": stats.get('pe', 0),
                "pp": stats.get('pp', 0),
                "goles": stats.get('goles', 0),
                "asistencias": stats.get('asistencias', 0),
                "amarillas": stats.get('amarillas', 0),
                "rojas": stats.get('rojas', 0),
                "mvp": stats.get('mvp', 0)
            }
            if row["player_name"]:
                rows.append(row)
    return rows

def process_config(data):
    return [{"key": "users", "value": data}]

def process_matches(data):
    rows = []
    for m in data:
        # Convert date D/M/YYYY to YYYY-MM-DD
        fecha_in = m.get('fecha', m.get('FECHA', ''))
        fecha_db = None
        if fecha_in:
            parts = fecha_in.split('/')
            if len(parts) == 3:
                d = parts[0].zfill(2)
                m_part = parts[1].zfill(2)
                y = parts[2]
                fecha_db = f"{y}-{m_part}-{d}"
        
        # Convert players list to object
        players_obj = {}
        # The matches.json can have 'jugadores' as a list of objects
        jugadores_raw = m.get('jugadores', [])
        if isinstance(jugadores_raw, list):
            for p in jugadores_raw:
                name = p.get('nombre', p.get('PLAYER'))
                if name:
                    players_obj[name] = {
                        "goles": p.get('goles', 0),
                        "asistencias": p.get('asistencias', 0),
                        "amarillas": p.get('amarillas', 0),
                        "rojas": p.get('rojas', 0),
                        "mvp": p.get('mvp', False)
                    }
        elif isinstance(jugadores_raw, dict):
            players_obj = jugadores_raw

        rows.append({
            "id": m.get('id', m.get('ID')),
            "fecha": fecha_db,
            "torneo": m.get('torneo', ''),
            "instancia": m.get('instancia', m.get('INSTANCIA', '')),
            "rival": m.get('rival', m.get('VS', '')),
            "gf": int(m.get('gf', m.get('GF', 0))) if m.get('gf', m.get('GF')) != '' else 0,
            "gc": int(m.get('gc', m.get('GC', 0))) if m.get('gc', m.get('GC')) != '' else 0,
            "lugar": m.get('lugar', m.get('LUGAR', '')),
            "jugadores": players_obj
        })
    return rows

def process_upcoming(data):
    rows = []
    for u in data:
        fecha_in = u.get('fecha', '')
        fecha_db = None
        if fecha_in:
            parts = fecha_in.split('/')
            if len(parts) == 3:
                d = parts[0].zfill(2)
                m_part = parts[1].zfill(2)
                y = parts[2]
                fecha_db = f"{y}-{m_part}-{d}"
        
        rows.append({
            "fecha": fecha_db,
            "hora": u.get('hora', ''),
            "rival": u.get('rival', ''),
            "torneo": u.get('torneo', ''),
            "instancia": u.get('instancia', ''),
            "lugar": u.get('lugar', '')
        })
    return rows

if __name__ == "__main__":
    print("Starting Supabase Migration (Fix 2)...")
    
    # 1. Config
    upload_json("config", os.path.join(DATA_DIR, "config.json"), process_config)
    
    # 2. Matches
    upload_json("matches", os.path.join(DATA_DIR, "matches.json"), process_matches)
    
    # 3. Players Stats
    upload_json("players_stats", os.path.join(DATA_DIR, "players.json"), process_players)
    
    # 4. Upcoming
    upload_json("upcoming", os.path.join(DATA_DIR, "upcoming.json"), process_upcoming)

    print("Migration finished!")
