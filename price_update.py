import json
import cloudscraper
import time
import os

# --- KONFIGURATION ---
OUTPUT_FILE = "prices_cache.json"
PRICE_API_URL = "https://api.skinport.com/v1/items?app_id=730&currency=EUR"
STEAM_FACTOR = 1.40  # Umrechnung von Skinport-Cash auf Steam-Guthaben

def fetch_prices():
    print(f"🌍 Verbinde zu Skinport API...")
    print(f"   URL: {PRICE_API_URL}")
    
    scraper = cloudscraper.create_scraper()
    headers = {
        "Accept-Encoding": "gzip, deflate, br", 
        "Accept": "application/json"
    }

    try:
        start_time = time.time()
        response = scraper.get(PRICE_API_URL, headers=headers)
        
        if response.status_code == 429:
            print("❌ FEHLER 429: Zu viele Anfragen! Du wurdest kurzzeitig blockiert.")
            print("   Warte 5-10 Minuten und versuche es erneut.")
            return

        if response.status_code != 200:
            print(f"❌ API Fehler: {response.status_code}")
            return

        data = response.json()
        duration = time.time() - start_time
        
        # --- VERARBEITUNG ---
        # Wir speichern die Preise in einem kompakten Format für die HTML-Datei
        # Format: { "AK-47 | Slate (Factory New)": 15.50, ... }
        
        processed_prices = {}
        count = 0
        
        print(f"⚙️  Verarbeite Daten (Faktor x{STEAM_FACTOR})...")
        
        for item in data:
            name = item.get('market_hash_name')
            price = item.get('min_price')
            
            if name and price is not None:
                # Umrechnung auf Steam-Niveau
                steam_price = float(price) * STEAM_FACTOR
                processed_prices[name] = round(steam_price, 2)
                count += 1

        # Speichern
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(processed_prices, f, separators=(',', ':')) # Minified JSON
            
        file_size = os.path.getsize(OUTPUT_FILE) / 1024 # KB

        print("-" * 50)
        print(f"✅ ERFOLG! {count} Preise gespeichert.")
        print(f"📂 Datei: '{OUTPUT_FILE}' ({file_size:.2f} KB)")
        print(f"⏱️  Dauer: {duration:.2f} Sekunden")
        print("-" * 50)
        print("💡 Du kannst diese Datei jetzt in den HTML-Rechner laden.")

    except Exception as e:
        print(f"❌ Ein kritischer Fehler ist aufgetreten: {e}")

if __name__ == "__main__":
    fetch_prices()
    # Damit sich das Fenster nicht sofort schließt (falls per Doppelklick gestartet)
    input("\nDrücke Enter zum Beenden...")