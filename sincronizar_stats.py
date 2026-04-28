import urllib.request
import json
import csv
import os

# --- CONFIGURACION ---
SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co"
SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

DIR_EXCEL = "DATOS EXCEL"
CSV_PARTIDOS = os.path.join(DIR_EXCEL, "BUFARRA ESTADISTICAS - PARTIDOS.csv")
CSV_DETALLE = os.path.join(DIR_EXCEL, "BUFARRA ESTADISTICAS - DETALLE.csv")
CSV_JUGADORES = os.path.join(DIR_EXCEL, "BUFARRA ESTADISTICAS - JUGADORES.csv")

def remove_accents(txt):
    if not txt: return ""
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', txt) if unicodedata.category(c) != 'Mn').title()

def fetch_supabase(endpoint):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{endpoint}", headers=HEADERS)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def read_csv(filepath):
    if not os.path.exists(filepath): return [], []
    with open(filepath, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            return [], []
        rows = list(reader)
        return headers, rows

def write_csv(filepath, headers, rows):
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if headers: writer.writerow(headers)
        writer.writerows(rows)

print("Descargando partidos de Supabase...")
matches_all = fetch_supabase("matches?order=fecha.asc")
matches_2026 = [m for m in matches_all if str(m.get('fecha', '')).startswith('2026') or str(m.get('fecha', '')).endswith('2026')]
print(f"Se encontraron {len(matches_2026)} partidos de 2026 (de {len(matches_all)} totales).")

# 1. ACTUALIZAR PARTIDOS.CSV
p_headers, p_rows = read_csv(CSV_PARTIDOS)
p_rows_historico = [row for row in p_rows if len(row) > 0 and str(row[0]) != '2026']

for m in matches_2026:
    year = "2026"
    fecha = m.get('fecha', '')
    if '-' in fecha:
        parts = fecha.split('-')
        fecha = f"{int(parts[2])}/{int(parts[1])}/{parts[0]}"
        
    torneo = m.get('torneo', '')
    instancia = m.get('instancia', '')
    rival = str(m.get('rival', '')).upper()
    gf = str(m.get('gf', '0'))
    gc = str(m.get('gc', '0'))
    res = 'V' if int(gf) > int(gc) else ('D' if int(gf) < int(gc) else 'E')
    lugar = m.get('lugar', '')
    p_rows_historico.insert(0, [year, fecha, torneo, instancia, rival, gf, gc, res, lugar])

write_csv(CSV_PARTIDOS, p_headers, p_rows_historico)
print("PARTIDOS.csv actualizado.")

# 2. ACTUALIZAR DETALLE.CSV
d_headers, d_rows = read_csv(CSV_DETALLE)
d_rows_historico = [row for row in d_rows if len(row) > 0 and str(row[0]) != '2026']

d_rows_2026 = []
for m in matches_2026:
    fecha = m.get('fecha', '')
    if '-' in fecha:
        parts = fecha.split('-')
        fecha = f"{int(parts[2])}/{int(parts[1])}/{parts[0]}"
    torneo = m.get('torneo', '')
    rival = str(m.get('rival', '')).upper()
    gf = int(m.get('gf', 0))
    gc = int(m.get('gc', 0))
    jugadores = m.get('jugadores', {})
    if jugadores:
        for name, stats in jugadores.items():
            if name == '__hora': continue
            n = remove_accents(name)
            if 'rocca' in n.lower(): n = 'Diego Rocca'
            if 'silva' in n.lower() and 'gaston' in n.lower(): n = 'Gaston Silva'
            
            g = int(stats.get('goles', 0))
            a = int(stats.get('asistencias', 0))
            am = int(stats.get('amarillas', 0))
            r = int(stats.get('rojas', 0))
            mvp = 1 if stats.get('mvp', False) else 0
            d_rows_2026.append(["2026", fecha, torneo, rival, n, str(g), str(a), str(am), str(r), str(mvp)])

write_csv(CSV_DETALLE, d_headers, d_rows_2026 + d_rows_historico)
print("DETALLE.csv actualizado.")

# 3. ACTUALIZAR JUGADORES.CSV (RESTAURANDO BASE + ALGEBRA NUETO)
j_headers, j_rows = read_csv(CSV_JUGADORES)

base_global = {} # Para almacenar Base(2025) = ActualGlobal - Actual2026
old_2026 = {}    # Lo que habia en 2026 antes de pisar
other_years_rows = [] # Lineas del 2025 para atras intactas

# Parseo de JUGADORES.csv
current_section = None
for row in j_rows:
    if len(row) == 0: continue
    if "---" in row[0]:
        current_section = row[0]
        if "2026" not in current_section and "GLOBAL" not in current_section:
            other_years_rows.append(row)
        continue
    
    if "TORNEO:" in row[0] or "HISTÓRICO" == row[0] or "2026" == row[0] or row[0] == "":
        if "2026" not in current_section and "GLOBAL" not in current_section:
            other_years_rows.append(row)
        # Procesar data real
        if len(row) >= 11 and row[0] in ["HISTÓRICO", "2026"]:
            # pj, pg, pe, pp, goles, asistencias, amarillas, rojas, mvp
            stats = [int(x) if str(x).isdigit() else 0 for x in row[2:11]]
            p_name = remove_accents(row[1])
            if row[0] == "HISTÓRICO":
                base_global[p_name] = stats
            elif row[0] == "2026":
                old_2026[p_name] = stats
        else:
            if "2026" not in current_section and "GLOBAL" not in current_section:
                pass # Ya está agregado arriba
            continue

# Algebra: Restar el viejo 2026 de la BaseGlobal para quedarse solo con HISTÓRICO <2025 puro
for p, s26 in old_2026.items():
    if p in base_global:
        base_global[p] = [bg - s26[i] for i, bg in enumerate(base_global[p])]

# Ahora calcular el NUEVO 2026 puramente de Supabase
new_2026 = {}
for m in matches_2026:
    gf = int(m.get('gf', 0))
    gc = int(m.get('gc', 0))
    res_index = 1 if gf > gc else (3 if gf < gc else 2) # pg=1, pe=2, pp=3 (indices)
    
    jug = m.get('jugadores', {})
    if jug:
        for name, stats in jug.items():
            if name == '__hora': continue
            n = remove_accents(name)
            if n not in new_2026:
                # pj, pg, pe, pp, goles, asistencias, amarillas, rojas, mvp
                new_2026[n] = [0]*9
                
            new_2026[n][0] += 1
            new_2026[n][res_index] += 1
            new_2026[n][4] += int(stats.get('goles', 0))
            new_2026[n][5] += int(stats.get('asistencias', 0))
            new_2026[n][6] += int(stats.get('amarillas', 0))
            new_2026[n][7] += int(stats.get('rojas', 0))
            new_2026[n][8] += (1 if stats.get('mvp', False) else 0)

# El NUEVO GLOBAL es la (BaseGlobal pura <2025) + nuevo_2026
new_global = {}
for p, s_base in base_global.items():
    new_global[p] = list(s_base)

for p, s_26 in new_2026.items():
    if p not in new_global:
        new_global[p] = [0]*9
    for i in range(9):
        new_global[p][i] += s_26[i]

# Escribir el nuevo archivo
j_out = []
empty = ['', '', '', '', '', '', '', '', '', '', '']

# --- HISTORICO GLOBAL ---
j_out.append(["--- HISTÓRICO GLOBAL ---"] + empty[1:])
sorted_g = sorted(new_global.items(), key=lambda x: (x[1][0], x[1][4]), reverse=True)
for p, stats in sorted_g:
    if sum(stats) == 0: continue # evitar jugadores borrados o basura
    j_out.append(["HISTÓRICO", p] + stats)
j_out.append(empty)

# --- 2026 ---
j_out.append(["--- ESTADÍSTICAS 2026 ---"] + empty[1:])
j_out.append(["TORNEO: Apertura"] + empty[1:])
sorted_26 = sorted(new_2026.items(), key=lambda x: (x[1][0], x[1][4]), reverse=True)
for p, stats in sorted_26:
    j_out.append(["2026", p] + stats)
j_out.append(empty)

# --- RESTO DE LOS AÑOS (Intactos) ---
for r in other_years_rows:
    j_out.append(r)

write_csv(CSV_JUGADORES, j_headers, j_out)
print("JUGADORES.csv actualizado (Álgebra: Base Histórica pura + Datos Supabase en vivo).")

# --- 4. EXPORTAR JSON PARA LA WEB (ULTRA IMPORTANTE PARA EL PLANTEL) ---
print("Generando archivos JSON para la web...")

# matches.json
with open('data/matches.json', 'w', encoding='utf-8') as f:
    json.dump(matches_all, f, indent=2, ensure_ascii=False)

# players.json (Mapeo por año)
# Para simplificar, el web lee un objeto donde cada año es una lista.
# Pero el script de álgebra ya genera j_out. Vamos a convertir j_out a un dict agrupado por año.
players_json = {}
current_yr = "ALL"
for row in j_out:
    if not row or len(row) < 2: continue
    if "---" in row[0]:
        if "GLOBAL" in row[0]: current_yr = "ALL"
        elif "2026" in row[0]: current_yr = "2026"
        elif "2025" in row[0]: current_yr = "2025"
        elif "2024" in row[0]: current_yr = "2024"
        elif "2023" in row[0]: current_yr = "2023"
        elif "2022" in row[0]: current_yr = "2022"
        elif "2021" in row[0]: current_yr = "2021"
        continue
    
    if row[0] == "" or "TORNEO:" in row[0]: continue
    
    if current_yr not in players_json: players_json[current_yr] = []
    
    # pj, pg, pe, pp, goles, asistencias, amarillas, rojas, mvp
    try:
        p_data = {
            "PLAYER": row[1],
            "PJ": int(row[2]),
            "PG": int(row[3]),
            "PE": int(row[4]),
            "PP": int(row[5]),
            "GOLES": int(row[6]),
            "ASISTENCIAS": int(row[7]),
            "AMARILLAS": int(row[8]),
            "ROJAS": int(row[9]),
            "MVP": int(row[10])
        }
        players_json[current_yr].append(p_data)
    except:
        continue

with open('data/players.json', 'w', encoding='utf-8') as f:
    json.dump(players_json, f, indent=2, ensure_ascii=False)

print("JSONs actualizados. ¡Ahora el plantel de la web debería cargar perfecto!")
print("FIN.")
