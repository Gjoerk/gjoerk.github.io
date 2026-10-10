import requests
import json
import os
import sys
from datetime import datetime, timezone

CONDITIONS = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"]

# Unter dieser Anzahl ist die API-Antwort kaputt -> alte Preise behalten statt überschreiben
MIN_EXPECTED_PRICES = 1000


def relevant_names():
    # Nur Skins, die in database.json vorkommen, landen in prices_cache.json (spart ~1 MB pro Seitenaufruf)
    with open("database.json", encoding="utf-8") as f:
        db = json.load(f)
    names = set()
    for skins in db.values():
        for s in skins:
            for prefix in ["", "StatTrak™ "]:
                for cond in CONDITIONS:
                    names.add(f"{prefix}{s['name']} ({cond})")
    return names


def fetch_steamapis_prices():
    # Den Key nur als Umgebungsvariable lesen (GitHub Secret oder lokal: export STEAMAPI_KEY=...)
    api_key = os.environ.get("STEAMAPI_KEY")
    if not api_key:
        sys.exit("❌ STEAMAPI_KEY ist nicht gesetzt.")

    print("🌍 Lade Preise von SteamAPIs.com...")
    url = f"https://api.steamapis.com/market/items/730?api_key={api_key}"

    try:
        response = requests.get(url, timeout=60)
    except requests.RequestException as e:
        sys.exit(f"❌ Netzwerkfehler: {e}")

    if response.status_code != 200:
        sys.exit(f"❌ Fehler: API antwortete mit Code {response.status_code}\nVorschau: {response.text[:200]}")

    items = response.json().get("data", [])
    wanted = relevant_names()

    print("⚙️ Verarbeite Daten...")
    prices_cache = {}
    for item in items:
        name = item.get("market_hash_name") or item.get("market_name")
        if name not in wanted:
            continue
        prices = item.get("prices", {})

        price = None
        if "safe_ts" in prices and "last_7d" in prices["safe_ts"]:
            price = prices["safe_ts"]["last_7d"]
        elif "safe" in prices:
            price = prices["safe"]
        elif "mean" in prices:
            price = prices["mean"]

        if price:
            prices_cache[name] = float(price)

    if len(prices_cache) < MIN_EXPECTED_PRICES:
        sys.exit(f"❌ Nur {len(prices_cache)} Preise erhalten - prices_cache.json wird nicht überschrieben.")

    prices_cache["_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with open("prices_cache.json", "w", encoding="utf-8") as f:
        json.dump(prices_cache, f, ensure_ascii=False, indent=0, separators=(",", ":"), sort_keys=True)

    print(f"✅ ERFOLG: {len(prices_cache) - 1} Steam-Preise erfolgreich gespeichert!")


if __name__ == "__main__":
    fetch_steamapis_prices()
