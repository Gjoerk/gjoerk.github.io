import requests
import json

def fetch_steam_prices():
    print("🌍 Lade Steam SCM Preise (CSGO Backpack API)...")
    url = "http://csgobackpack.net/api/GetItemsList/v2/"
    
    try:
        response = requests.get(url)
        data = response.json()
        
        prices_cache = {}
        items = data.get("items_list", {})
        
        for name, details in items.items():
            price_data = details.get("price")
            if not price_data: 
                continue
            
            # 7-Tage-Schnitt (Sicherste Metrik für Trade Ups)
            if "7_days" in price_data and "average" in price_data["7_days"]:
                prices_cache[name] = float(price_data["7_days"]["average"])
            elif "30_days" in price_data and "average" in price_data["30_days"]:
                prices_cache[name] = float(price_data["30_days"]["average"])

        # Speichern in die Cache-Datei
        with open("prices_cache.json", "w", encoding="utf-8") as f:
            json.dump(prices_cache, f, ensure_ascii=False, indent=2)
            
        print(f"✅ ERFOLG: {len(prices_cache)} Steam-Preise gespeichert!")

    except Exception as e:
        print(f"❌ Fehler: {e}")

if __name__ == "__main__":
    fetch_steam_prices()