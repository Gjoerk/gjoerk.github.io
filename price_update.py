import requests
import json

def fetch_cs2sh_prices():
    print("🌍 Lade Steam Preise von cs2.sh/steam...")
    url = "https://cs2.sh/steam"
    
    # Ein normaler Browser-Header reicht hier völlig aus
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Fehler: Server antwortete mit Code {response.status_code}")
            # Zeige die ersten paar Zeichen der Fehlermeldung an
            print(f"Vorschau: {response.text[:200]}")
            return
            
        data = response.json()
        prices_cache = {}
        
        print("⚙️ Verarbeite Daten...")
        
        # Fall 1: Die API liefert ein Dictionary (z.B. {"Skin Name": 12.34} oder {"Skin Name": {"price": 12.34}})
        if isinstance(data, dict):
            for name, price_info in data.items():
                if isinstance(price_info, (int, float)):
                    prices_cache[name] = float(price_info)
                elif isinstance(price_info, dict):
                    # Falls der Preis in einem Unter-Feld steckt
                    price = price_info.get("price") or price_info.get("value")
                    if price is not None:
                        prices_cache[name] = float(price)
                        
        # Fall 2: Die API liefert eine Liste (z.B. [{"name": "Skin", "price": 12.34}])
        elif isinstance(data, list):
            for item in data:
                name = item.get("market_hash_name") or item.get("name")
                price = item.get("price") or item.get("value")
                if name and price is not None:
                    prices_cache[name] = float(price)

        # Speichern für deinen HTML-Rechner
        with open("prices_cache.json", "w", encoding="utf-8") as f:
            json.dump(prices_cache, f, ensure_ascii=False, indent=2)
            
        print(f"✅ ERFOLG: {len(prices_cache)} Steam-Preise erfolgreich gespeichert!")

    except Exception as e:
        print(f"❌ Kritischer Fehler beim Auslesen: {e}")

if __name__ == "__main__":
    fetch_cs2sh_prices()