import requests
import json

def fetch_steam_prices_via_skinport():
    print("🌍 Lade Steam Preise (via Skinport Suggested Price)...")
    url = "https://api.skinport.com/v1/items?app_id=730&currency=EUR"
    
    try:
        # Skinport blockiert lokale Heim-IPs in der Regel nicht
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Fehler: Skinport antwortete mit Code {response.status_code}")
            return
            
        data = response.json()
        prices_cache = {}
        
        print("⚙️ Extrahiere Steam-Preise...")
        for item in data:
            name = item.get("market_hash_name")
            
            # suggested_price ist der von Skinport berechnete Steam-Marktpreis!
            steam_price = item.get("suggested_price") 
            
            if name and steam_price:
                prices_cache[name] = float(steam_price)

        with open("prices_cache.json", "w", encoding="utf-8") as f:
            json.dump(prices_cache, f, ensure_ascii=False, indent=2)
            
        print(f"✅ ERFOLG: {len(prices_cache)} Steam-Preise gespeichert!")

    except Exception as e:
        print(f"❌ Kritischer Fehler: {e}")

if __name__ == "__main__":
    fetch_steam_prices_via_skinport()