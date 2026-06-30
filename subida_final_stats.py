import csv
import json
import urllib.request

SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co"
SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

CSV_FILE = "DATOS EXCEL/BUFARRA ESTADISTICAS - JUGADORES.csv"

def subir_todo():
    print("Iniciando subida final de estadísticas a la nube...")
    rows = []
    
    with open(CSV_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        next(reader) # skip headers
        
        current_year = "ALL"
        for row in reader:
            if not row or not row[0]: continue
            if "---" in row[0]:
                if "GLOBAL" in row[0]: current_year = "ALL"
                else: 
                    # Extraer el año del título
                    parts = row[0].replace("-", "").strip().split(" ")
                    current_year = parts[-1] if parts else "ALL"
                continue
            
            if row[0] in ["Sección", "TORNEO:", "Jugador"] or "TORNEO:" in row[0]:
                continue
            
            # Formato: [Sección/Año], Jugador, PJ, PG, PE, PP, Goles, Asistencias, Amarillas, Rojas, MVP
            try:
                rows.append({
                    "year": str(current_year),
                    "player_name": row[1].strip(),
                    "pj": int(row[2]) if row[2] else 0,
                    "pg": int(row[3]) if row[3] else 0,
                    "pe": int(row[4]) if row[4] else 0,
                    "pp": int(row[5]) if row[5] else 0,
                    "goles": int(row[6]) if row[6] else 0,
                    "asistencias": int(row[7]) if row[7] else 0,
                    "amarillas": int(row[8]) if row[8] else 0,
                    "rojas": int(row[9]) if row[9] else 0,
                    "mvp": int(row[10]) if len(row) > 10 and row[10] else 0
                })
            except:
                continue

    # Borrar histórico previo para evitar basura
    print("Vaciando tabla previa...")
    del_req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/players_stats?pj=gte.0", headers=HEADERS, method='DELETE')
    urllib.request.urlopen(del_req)

    print(f"Subiendo {len(rows)} registros...")
    for i in range(0, len(rows), 50):
        chunk = rows[i:i+50]
        req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/players_stats", data=json.dumps(chunk).encode('utf-8'), headers=HEADERS, method='POST')
        urllib.request.urlopen(req)
        
    print("¡Nube actualizada con el Excel restaurado!")

if __name__ == "__main__":
    subir_todo()
