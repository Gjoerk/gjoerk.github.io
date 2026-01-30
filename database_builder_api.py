import requests
import json
import time

# URL zur "Raw" Datei auf GitHub (Englisch)
GITHUB_URL = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json"
OUTPUT_FILE = "database.json"

def fetch_from_github():
    print(f"🚀 Lade skins.json von ByMykel/CSGO-API herunter...")
    
    try:
        response = requests.get(GITHUB_URL)
        if response.status_code != 200:
            print(f"❌ Fehler beim Download: Status {response.status_code}")
            return
        
        # Die Datei ist riesig, das Parsen kann kurz dauern
        data = response.json()
        print(f"📦 {len(data)} Items heruntergeladen. Verarbeite Daten...")
        
        all_skins_by_collection = {}
        count_processed = 0
        
        for item in data:
            # 1. Basis-Filterung
            # Wir wollen nur Skins, die für Trade Ups relevant sind.
            # Filtere Messer, Handschuhe, Agenten etc. raus, falls sie in skins.json sind.
            # ByMykel trennt das meist gut, aber sicher ist sicher.
            category = item.get('category', {}).get('id', '')
            if category and category != "sfui_invpanel_filter_rifle" and \
               category != "sfui_invpanel_filter_pistol" and \
               category != "sfui_invpanel_filter_smg" and \
               category != "sfui_invpanel_filter_heavy":
                # Fallback: Wenn Category-ID komisch ist, prüfe Waffennamen
                weapon_id = item.get('weapon', {}).get('id', '')
                if not weapon_id or "knife" in weapon_id or "glove" in weapon_id:
                    continue

            name = item.get('name')
            
            # 2. Float Caps holen
            min_float = item.get('min_float')
            max_float = item.get('max_float')
            
            # Manche Skins (z.B. Vanilla) haben keine Floats -> Überspringen
            if min_float is None or max_float is None:
                continue
                
            # 3. Rarity holen
            rarity_obj = item.get('rarity')
            if not rarity_obj: continue
            rarity_name = rarity_obj.get('name') # z.B. "Mil-Spec Grade"
            
            # "Contraband" (Howl) kann nicht getrade-upt werden -> Skip
            if "Contraband" in rarity_name: continue

            # 4. Collection finden
            # ByMykel speichert Collections in einer Liste "collections"
            collections = item.get('collections', [])
            
            if not collections:
                continue # Skins ohne Collection (z.B. manche Exclusives) sind nutzlos für Trade Up
            
            # Wir nehmen die erste Collection in der Liste
            col_name = collections[0].get('name')
            
            # 5. Speichern
            if col_name not in all_skins_by_collection:
                all_skins_by_collection[col_name] = []
            
            # Skin Objekt erstellen
            skin_entry = {
                "name": name,
                "rarity": rarity_name,
                "min": float(min_float),
                "max": float(max_float)
            }
            
            all_skins_by_collection[col_name].append(skin_entry)
            count_processed += 1

        # 6. Datenbank bereinigen
        # Collections mit zu wenigen Skins (weniger als 2) bringen nichts
        final_db = {}
        for col, skins in all_skins_by_collection.items():
            if len(skins) > 1:
                final_db[col] = skins

        # Speichern
        print(f"💾 Speichere {count_processed} Skins aus {len(final_db)} Collections in '{OUTPUT_FILE}'...")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_db, f, indent=4)
            
        print("✅ Fertig! Deine Datenbank ist jetzt auf dem neuesten Stand.")

    except Exception as e:
        print(f"❌ Kritischer Fehler: {e}")

if __name__ == "__main__":
    fetch_from_github()