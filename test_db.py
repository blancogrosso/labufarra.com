import urllib.request
import json
with open('js/db.js', 'r', encoding='utf-8') as f:
    js = f.read()
lines = js.split('\n')
url_line = next(line for line in lines if 'const SUPABASE_URL' in line)
key_line = next(line for line in lines if 'const SUPABASE_KEY' in line)
url = url_line.split("'")[1] + "/rest/v1/"
key = key_line.split("'")[1]

req = urllib.request.Request(url + "players_stats?select=*&year=eq.ALL", headers={"apikey": key, "Authorization": f"Bearer {key}"})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print("Players:", len(data))

req2 = urllib.request.Request(url + "matches?select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"})
with urllib.request.urlopen(req2) as response:
    data2 = json.loads(response.read().decode())
    print("Matches:", len(data2))
