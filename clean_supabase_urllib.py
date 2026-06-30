import urllib.request
import json
import unicodedata

SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co"
SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def remove_accents(input_str):
    if not input_str: return input_str
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)])

def make_request(url, method="GET", json_data=None):
    data = None
    if json_data is not None:
        data = json.dumps(json_data).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read()
            if res_body:
                return json.loads(res_body.decode('utf-8'))
            return []
    except Exception as e:
        print(f"Error making request to {url}: {e}")
        return []

def clean_matches():
    print("Fetching matches...")
    matches = make_request(f"{SUPABASE_URL}/rest/v1/matches?select=*")
    for m in matches:
        changed = False
        jugadores = m.get('jugadores', {})
        new_jugadores = {}
        for name, stats in jugadores.items():
            new_name = remove_accents(name)
            new_name = " ".join([w.capitalize() for w in new_name.split()])

            if new_name == "Guillermo Rodriguez" or name.lower() == "rodrigues":
                new_name = "Guillermo Rodriguez"
            if name.lower() in ["de leon", "de león", "deleon"]:
                new_name = "Enzo De Leon"
            if name.lower() == "pedemonte":
                new_name = "Sebastian Pedemonte"
            if name.lower() in ["da silveira", "guzman da silveira"]:
                new_name = "Guzman Da Silveira"
                
            if new_name != name:
                changed = True
            new_jugadores[new_name] = stats
            
        if changed:
            print(f"Updating match {m['id']} rival {m['rival']}")
            make_request(f"{SUPABASE_URL}/rest/v1/matches?id=eq.{m['id']}", method="PATCH", json_data={"jugadores": new_jugadores})

def clean_config():
    print("Fetching config.roster...")
    roster_res = make_request(f"{SUPABASE_URL}/rest/v1/config?key=eq.roster")
    if roster_res:
        roster = roster_res[0].get('value', [])
        new_roster = []
        for r in roster:
            clean = remove_accents(r)
            if clean.lower() == "da silveira": clean = "Guzman Da Silveira"
            new_roster.append(clean)
        
        # Deduplicate
        new_roster = list(dict.fromkeys(new_roster))
        make_request(f"{SUPABASE_URL}/rest/v1/config?key=eq.roster", method="PATCH", json_data={"value": new_roster})
        print("Updated roster.")

if __name__ == "__main__":
    clean_matches()
    clean_config()
    print("DONE cleaning names.")
