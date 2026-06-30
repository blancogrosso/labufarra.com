#!/usr/bin/env python3
"""
Migración de datos CSV → JSON para La Bufarra.
Lee los CSVs actuales y genera los archivos JSON iniciales.
Ejecutar una sola vez: python3 migrate.py
"""

import csv
import json
import os
import hashlib
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
CSV_DIR = os.path.join(BASE_DIR, 'DATOS EXCEL')

def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)

def parse_date_for_sort(date_str):
    """Parse D/M/YYYY -> sortable int"""
    if not date_str:
        return 0
    parts = date_str.strip().split('/')
    if len(parts) < 3:
        return 0
    try:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
        if y < 100:
            y += 2000
        return y * 10000 + m * 100 + d
    except:
        return 0

def migrate_matches():
    """Read PARTIDOS CSV and convert to JSON"""
    csv_path = os.path.join(CSV_DIR, 'BUFARRA ESTADISTICAS - PARTIDOS.csv')
    if not os.path.exists(csv_path):
        print(f"⚠️  No se encontró: {csv_path}")
        return []
    
    matches = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header_found = False
        match_id = 1
        
        for row in reader:
            if not row:
                continue
            
            # Look for header row
            line_upper = ','.join(row).upper()
            if 'AÑO' in line_upper and 'FECHA' in line_upper and 'TORNEO' in line_upper:
                header_found = True
                continue
            
            if header_found:
                # Find the year column (4-digit year)
                start_idx = -1
                for i, cell in enumerate(row):
                    if re.match(r'^20[2-3]\d$', cell.strip()):
                        start_idx = i
                        break
                
                if start_idx == -1:
                    continue
                
                data = row[start_idx:]
                if len(data) < 8:
                    data.extend([''] * (8 - len(data)))
                
                año = data[0].strip()
                fecha = data[1].strip()
                torneo = data[2].strip()
                instancia = data[3].strip()
                rival = data[4].strip()
                gf = data[5].strip()
                gc = data[6].strip()
                lugar = data[7].strip()
                
                if not rival or not gf or not gc:
                    continue
                
                try:
                    gf_int = int(gf)
                    gc_int = int(gc)
                except:
                    continue
                
                # Determine result
                if gf_int > gc_int:
                    resultado = 'V'
                elif gf_int == gc_int:
                    resultado = 'E'
                else:
                    resultado = 'D'
                
                match = {
                    'id': f'm{match_id}',
                    'año': año,
                    'fecha': fecha,
                    'torneo': torneo,
                    'instancia': instancia if instancia != '-' else '',
                    'rival': rival,
                    'gf': gf_int,
                    'gc': gc_int,
                    'lugar': lugar,
                    'resultado': resultado,
                    'jugadores': []  # Per-player data will be added via admin
                }
                matches.append(match)
                match_id += 1
    
    # Sort by date (newest first)
    matches.sort(key=lambda m: parse_date_for_sort(m['fecha']), reverse=True)
    
    print(f"✅ Migrados {len(matches)} partidos")
    return matches

def migrate_players():
    """Read HISTÓRICO CSV and extract player stats by year + global"""
    csv_path = None
    for fname in os.listdir(CSV_DIR):
        if 'HIST' in fname.upper() and fname.endswith('.csv'):
            csv_path = os.path.join(CSV_DIR, fname)
            break
    
    if not csv_path:
        print("⚠️  No se encontró CSV histórico")
        return {}
    
    players_by_year = {'ALL': []}
    current_year = None
    global_started = False
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        
        for row in reader:
            if not row:
                continue
            
            # Pad row to at least 23 columns
            while len(row) < 23:
                row.append('')
            
            # Check for global table header (column 11 = PLAYER)
            if row[11] and 'PLAYER' in row[11].upper():
                global_started = True
                continue
            
            # Global table data
            if global_started and row[11] and 'HISTÓRICO' not in row[11]:
                player = {
                    'nombre': row[11].strip(),
                    'pj': int(row[12] or 0),
                    'pg': int(row[13] or 0),
                    'pe': int(row[14] or 0),
                    'pp': int(row[15] or 0),
                    'goles': int(row[16] or 0),
                    'asistencias': int(row[17] or 0),
                    'amarillas': int(row[18] or 0),
                    'rojas': int(row[19] or 0),
                    'mvp': int(row[20] or 0)
                }
                if player['nombre'] and player['nombre'] != 'PLAYER' and player['pj'] > 0:
                    players_by_year['ALL'].append(player)
            
            # Yearly tables (left side, column 0)
            if row[0] and row[0].startswith('ESTADÍSTICAS '):
                current_year = row[0].replace('ESTADÍSTICAS ', '').strip()
                players_by_year[current_year] = []
            elif current_year and row[0] and row[0].strip() != 'PLAYER' and row[0].strip() != '':
                try:
                    player = {
                        'nombre': row[0].strip(),
                        'pj': int(row[1] or 0),
                        'pg': int(row[2] or 0),
                        'pe': int(row[3] or 0),
                        'pp': int(row[4] or 0),
                        'goles': int(row[5] or 0),
                        'asistencias': int(row[6] or 0),
                        'amarillas': int(row[7] or 0),
                        'rojas': int(row[8] or 0),
                        'mvp': int(row[9] or 0)
                    }
                    players_by_year[current_year].append(player)
                except (ValueError, IndexError):
                    pass
    
    total_players = sum(len(v) for v in players_by_year.values())
    print(f"✅ Migrados {total_players} registros de jugadores ({len(players_by_year)} grupos)")
    return players_by_year

def create_roster():
    """Create the active player roster from the latest year in the CSV"""
    roster = [
        "Anzuatte", "Blanco", "Bonilla", "Colombo", "Da Silveira",
        "De León", "Flores", "Iza", "Martinez", "Mari", "Mateo",
        "Menchaca", "Molina", "Olarte", "Pedemonte", "Sparkov"
    ]
    return roster

def create_config(password):
    """Create config with hashed password using bcrypt-like approach with hashlib"""
    import hashlib
    import secrets
    # Use PBKDF2 with SHA-256 (built-in, secure)
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    
    return {
        'auth': {
            'salt': salt,
            'hash': hashed
        },
        'roster': create_roster()
    }

def main():
    print("═══════════════════════════════════════")
    print("  Migración La Bufarra: CSV → JSON")
    print("═══════════════════════════════════════")
    
    ensure_data_dir()
    
    # 1. Migrate matches
    matches = migrate_matches()
    with open(os.path.join(DATA_DIR, 'matches.json'), 'w', encoding='utf-8') as f:
        json.dump(matches, f, ensure_ascii=False, indent=2)
    
    # 2. Migrate players
    players = migrate_players()
    with open(os.path.join(DATA_DIR, 'players.json'), 'w', encoding='utf-8') as f:
        json.dump(players, f, ensure_ascii=False, indent=2)
    
    # 3. Create empty upcoming matches
    with open(os.path.join(DATA_DIR, 'upcoming.json'), 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)
    
    # 4. Create empty finances
    finances_init = {
        'cuotas': {},
        'costoFecha': 0,
        'multas': [],
        'transacciones': [],
        'deadlines': []
    }
    with open(os.path.join(DATA_DIR, 'finances.json'), 'w', encoding='utf-8') as f:
        json.dump(finances_init, f, ensure_ascii=False, indent=2)
    
    # 5. Create config with hashed password
    config = create_config('feche2018')
    with open(os.path.join(DATA_DIR, 'config.json'), 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    print("═══════════════════════════════════════")
    print(f"  ✅ Migración completa!")
    print(f"  📁 Archivos creados en: {DATA_DIR}/")
    print(f"     - matches.json ({len(matches)} partidos)")
    print(f"     - players.json")
    print(f"     - upcoming.json")
    print(f"     - finances.json")
    print(f"     - config.json (password hasheada)")
    print("═══════════════════════════════════════")

if __name__ == '__main__':
    main()
