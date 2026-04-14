import requests
import json

url = "https://hmaqdzkpjkxamggaiypo.supabase.co/rest/v1/players_stats?year=eq.ALL&player_name=eq.Gaston%20Silva"
headers = {
    "apikey": "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y",
    "Authorization": "Bearer sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

data = {
    "pj": 3,
    "pg": 1,
    "pe": 0,
    "pp": 2,
    "goles": 0,
    "asistencias": 0,
    "amarillas": 0,
    "rojas": 0
}

response = requests.patch(url, headers=headers, json=data)
print(response.status_code)
print(response.json())
