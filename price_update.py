import requests
import json
import os

def fetch_steamapis_prices():
    # Versucht, den geheimen Key von GitHub zu laden. Wenn du es lokal am PC 
    # startest, nimmt er einfach deinen festen Key als "Backup".
    api_key = os.environ.get("STEAMAPI_KEY", "AlhBugTunRO3FsGWuVLA9rIMv3c")
    
    print("🌍 Lade Preise von SteamAPIs.com...")
    url = f"https://api.steamapis.com/market/items/730?api_key={api_key}"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Fehler: API antwortete mit Code {response.status_code}")
            print(f"Vorschau: {response.text[:200]}")
            return
            
        data = response.json()
        prices_cache = {}
        items = data.get("data", [])
        
        print("⚙️ Verarbeite Daten...")
        for item in items:
            name = item.get("market_hash_name") or item.get("market_name")
            prices = item.get("prices", {})
            
            price = None
            if "safe_ts" in prices and "last_7d" in prices["safe_ts"]:
                price = prices["safe_ts"]["last_7d"]
            elif "safe" in prices:
                price = prices["safe"]
            elif "mean" in prices:
                price = prices["mean"]
            
            if name and price:
                prices_cache[name] = float(price)

        with open("prices_cache.json", "w", encoding="utf-8") as f:
            json.dump(prices_cache, f, ensure_ascii=False, indent=2)
            
        print(f"✅ ERFOLG: {len(prices_cache)} Steam-Preise erfolgreich gespeichert!")

    except Exception as e:
        print(f"❌ Kritischer Fehler beim Auslesen: {e}")

if __name__ == "__main__":
    fetch_steamapis_prices()
