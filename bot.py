import json
import os
import cloudscraper
import struct
import time
import math

# --- KONFIGURATION ---
DATABASE_FILE = "database.json"
PRICES_CACHE_FILE = "prices_cache.json"
OUTPUT_FILENAME = "profitable_tradeups.txt"
PRICE_API_URL = "https://api.skinport.com/v1/items?app_id=730&currency=EUR"

# --- EINSTELLUNGEN ---
MAX_TRADEUP_COST = 25.0   # Budget
MIN_ROI = 10.0            # Mindestens 10% Gewinn
STEAM_FACTOR = 1.40       # Umrechnung Skinport -> Steam
FLOAT_BUFFER = 0.015      # Puffer (Abstand zum Boden)
ENABLE_MIXED_MODE = True  

RARITY_ORDER = ["Consumer Grade", "Industrial Grade", "Mil-Spec Grade", "Restricted", "Classified", "Covert"]

class TradeUpBot:
    def __init__(self):
        self.prices = {}       
        self.collections = {}
        self.cheapest_fillers = {}
        self.unique_best_results = {} 

    def load_static_data(self):
        if not os.path.exists(DATABASE_FILE):
            print(f"❌ FEHLER: '{DATABASE_FILE}' fehlt!")
            return False   
        try:
            with open(DATABASE_FILE, 'r', encoding='utf-8') as f:
                self.collections = json.load(f)
            print(f"✅ Datenbank geladen.")
            return True
        except Exception as e:
            print(f"❌ JSON Format Fehler: {e}")
            return False

    def fetch_live_prices(self):
        if os.path.exists(PRICES_CACHE_FILE):
            if (time.time() - os.path.getmtime(PRICES_CACHE_FILE)) < 3600:
                try:
                    with open(PRICES_CACHE_FILE, 'r', encoding='utf-8') as f:
                        self._process_price_data(json.load(f))
                        return True
                except: pass

        print("⏳ Lade Preise von Skinport...")
        scraper = cloudscraper.create_scraper()
        try:
            response = scraper.get(PRICE_API_URL)
            if response.status_code != 200: return False
            data = response.json()
            with open(PRICES_CACHE_FILE, 'w', encoding='utf-8') as f: json.dump(data, f)
            self._process_price_data(data)
            return True
        except: return False

    def _process_price_data(self, data):
        count = 0
        for item in data:
            name = item.get('market_hash_name')
            price = item.get('min_price')
            if name and price:
                self.prices[name] = float(price) * STEAM_FACTOR
                count += 1
        print(f"✅ {count} Preise geladen.")

    def find_best_fillers(self):
        print("🔍 Indexiere Filler-Skins...")
        for col, skins in self.collections.items():
            for s in skins:
                r = s['rarity']
                for c in ["(Factory New)", "(Minimal Wear)"]:
                    name = f"{s['name']} {c}"
                    if name in self.prices:
                        p = self.prices[name]
                        key = f"{r}_{c}"
                        if key not in self.cheapest_fillers or p < self.cheapest_fillers[key]['price']:
                            try:
                                n_r = RARITY_ORDER[RARITY_ORDER.index(r)+1]
                                outcomes = [x for x in skins if x['rarity'] == n_r]
                                if outcomes:
                                    self.cheapest_fillers[key] = {
                                        "name": s['name'], "cond": c, "price": p, 
                                        "min": s['min'], "max": s['max'], 
                                        "outcomes": outcomes, "collection": col
                                    }
                            except: continue

    # --- CORE MATH FUNCTIONS (IEEE 754 + NEW FORMULA) ---
    
    def to_32bit(self, value):
        return struct.unpack('f', struct.pack('f', value))[0]

    def get_trade_float(self, real_float, min_cap, max_cap):
        """
        Step 1: Input Float Normalization
        t.float = (a.float - l.cap) / (h.cap - l.cap)
        """
        range_val = max_cap - min_cap
        if range_val == 0: return 0.0 # Should not happen usually
        return (real_float - min_cap) / range_val

    def get_real_float_from_trade(self, trade_float, min_cap, max_cap):
        """
        Reverse Step 1: Get real float from normalized trade float
        a.float = (t.float * (h.cap - l.cap)) + l.cap
        """
        range_val = max_cap - min_cap
        return (trade_float * range_val) + min_cap

    def calculate_output_float(self, avg_trade_float, out_min, out_max):
        """
        Step 2: Output Float Calculation (IEEE 32-bit Sim)
        o.float = (avg.t.float * (h.cap - l.cap)) + l.cap
        """
        avg_32 = self.to_32bit(avg_trade_float)
        range_32 = self.to_32bit(out_max - out_min)
        step1 = self.to_32bit(avg_32 * range_32)
        final = self.to_32bit(step1 + out_min)
        return final

    def get_condition_info(self, float_val):
        if float_val < 0.07: return "(Factory New)"
        if float_val < 0.15: return "(Minimal Wear)"
        if float_val < 0.38: return "(Field-Tested)"
        if float_val < 0.45: return "(Well-Worn)"
        return "(Battle-Scarred)"

    def get_condition_limits(self, cond_name):
        if cond_name == "(Factory New)": return 0.00, 0.07
        if cond_name == "(Minimal Wear)": return 0.07, 0.15
        if cond_name == "(Field-Tested)": return 0.15, 0.38
        if cond_name == "(Well-Worn)": return 0.38, 0.45
        return 0.45, 1.00

    def calculate_tradeup(self):
        self.find_best_fillers()
        print(f"\n--- ANALYSE STARTEN (New Formula + IEEE 754) ---")
        self.unique_best_results = {}
        
        for col_name, skins in self.collections.items():
            by_rarity = {}
            for s in skins: 
                if s['rarity'] not in by_rarity: by_rarity[s['rarity']] = []
                by_rarity[s['rarity']].append(s)

            for rarity, input_skins in by_rarity.items():
                try:
                    curr_idx = RARITY_ORDER.index(rarity)
                    next_rarity = RARITY_ORDER[curr_idx + 1]
                except: continue
                
                if next_rarity not in by_rarity: continue
                possible_outputs = by_rarity[next_rarity]

                # Check if outcomes can be FN
                impossible = False
                for out in possible_outputs:
                    if out['min'] >= 0.07: impossible = True; break
                if impossible: continue

                for input_skin in input_skins:
                    self._sim("10x", input_skin, possible_outputs, 10, None)
                    if ENABLE_MIXED_MODE:
                        for fk in [f"{rarity}_(Factory New)", f"{rarity}_(Minimal Wear)"]:
                            if fk in self.cheapest_fillers:
                                self._sim("3x+7x", input_skin, possible_outputs, 3, self.cheapest_fillers[fk])
                                self._sim("1x+9x", input_skin, possible_outputs, 1, self.cheapest_fillers[fk])

        self._write_results()

    def _sim(self, mode, main_skin, main_outs, main_count, filler):
        filler_count = 10 - main_count
        
        for cond in ["(Factory New)", "(Minimal Wear)", "(Field-Tested)"]:
            name = f"{main_skin['name']} {cond}"
            if name not in self.prices: continue
            main_price = self.prices[name]

            # 1. Bestimme Filler Trade Float (Normalisiert)
            filler_trade_float = 0.0
            filler_price = 0.0
            
            if filler:
                filler_price = filler['price']
                # Annahme: Wir kaufen Filler mit "sicherem" Float für die Condition
                f_assumed_raw = 0.0
                if filler['cond'] == "(Factory New)": f_assumed_raw = 0.035
                elif filler['cond'] == "(Minimal Wear)": f_assumed_raw = 0.10
                else: f_assumed_raw = 0.20
                
                # WICHTIG: Assumed Raw muss im Cap-Bereich des Fillers liegen!
                f_real_min = max(self.get_condition_limits(filler['cond'])[0], filler['min'])
                f_assumed_raw = max(f_assumed_raw, f_real_min)
                
                # Berechne den Trade Float des Fillers
                filler_trade_float = self.get_trade_float(f_assumed_raw, filler['min'], filler['max'])

            # 2. Berechne maximal erlaubten AVG TRADE FLOAT
            # Wir wollen Output < 0.07
            # o.float = (avg.t * range) + min
            # avg.t <= (0.07 - min) / range
            
            # Wir müssen den strengsten Wert aller Outcomes finden
            req_avg_trade_float = 1.0
            
            for out in main_outs:
                range_val = out['max'] - out['min']
                if range_val == 0: continue
                # Wir zielen auf 0.0699
                req = (0.0699 - out['min']) / range_val
                if req < req_avg_trade_float: req_avg_trade_float = req
            
            if req_avg_trade_float <= 0: continue
            if req_avg_trade_float > 1.0: req_avg_trade_float = 1.0
            
            # 3. Berechne maximalen Main Trade Float
            # AvgTrade = (MainCount * MainTrade + FillerCount * FillerTrade) / 10
            # MainTrade <= (10 * ReqAvgTrade - FillerCount * FillerTrade) / MainCount
            
            max_main_trade_float = ((10 * req_avg_trade_float) - (filler_count * filler_trade_float)) / main_count
            
            # Clamp auf 0-1 (Trade Float Limits)
            if max_main_trade_float > 1.0: max_main_trade_float = 1.0
            if max_main_trade_float < 0.0: continue # Unmöglich
            
            # 4. Konvertiere zurück in ECHTEN Float für den Main Skin
            # real = (trade * range) + min
            max_main_real_float = self.get_real_float_from_trade(max_main_trade_float, main_skin['min'], main_skin['max'])
            
            # 5. Validierung: Passt dieser echte Float in die Condition?
            cond_min, cond_max = self.get_condition_limits(cond)
            true_bottom = max(cond_min, main_skin['min'])
            
            # Wenn der erlaubte Max Float kleiner ist als der Boden -> Unmöglich
            if max_main_real_float < true_bottom: continue
            
            # 6. Safety Loop (Rundungsfehler abfangen)
            # Wir testen den Float und gehen in kleinen Schritten runter, bis es sicher passt
            test_float = min(max_main_real_float, cond_max)
            found_safe = False
            
            for _ in range(15): # Max 15 Schritte
                if test_float < true_bottom: break
                
                # Trade Float für diesen Test-Float berechnen
                t_main = self.get_trade_float(test_float, main_skin['min'], main_skin['max'])
                
                # Avg Trade Float (32-bit Sim)
                sum_t = (t_main * main_count) + (filler_trade_float * filler_count)
                avg_t = self.to_32bit(sum_t / 10.0)
                
                all_fn = True
                for out in main_outs:
                    res_f = self.calculate_output_float(avg_t, out['min'], out['max'])
                    if res_f >= 0.07:
                        all_fn = False
                        break
                
                if all_fn:
                    found_safe = True
                    max_main_real_float = test_float # Update mit sicherem Wert
                    break
                
                # Kleiner Schritt runter
                test_float -= 0.001
                
            if not found_safe: continue
            
            # 7. Buffer Check
            space = max_main_real_float - true_bottom
            if space < FLOAT_BUFFER: continue

            # KOSTEN & PROFIT
            cost = (main_count * main_price) + (filler_count * filler_price)
            if cost > MAX_TRADEUP_COST: continue

            exp_val = 0
            details = []
            
            # Simulation für Anzeige (mit dem sicheren Float)
            t_main = self.get_trade_float(max_main_real_float, main_skin['min'], main_skin['max'])
            avg_t = self.to_32bit(((t_main * main_count) + (filler_trade_float * filler_count)) / 10.0)
            
            prob_main = (main_count/10) * (1/len(main_outs))
            
            for out in main_outs:
                out_f = self.calculate_output_float(avg_t, out['min'], out['max'])
                out_c = self.get_condition_info(out_f)
                
                p_name = f"{out['name']} {out_c}"
                p = self.prices.get(p_name, self.prices.get(f"{out['name']} (Minimal Wear)", 0))
                
                net = p * 0.85 
                profit = net - cost
                icon = "✅" if profit > 0 else "❌"
                
                details.append(f"   {icon} [MAIN] {out['name']} {out_c} (F:{out_f:.5f}): {net:.2f}€")
                exp_val += net * prob_main

            if filler:
                prob_filler = (filler_count/10) * (1/len(filler['outcomes']))
                for o in filler['outcomes']:
                    p = self.prices.get(f"{o['name']} (Minimal Wear)", 0) 
                    exp_val += (p * 0.85) * prob_filler

            if exp_val == 0: continue
            roi = ((exp_val - cost) / cost) * 100
            
            if roi > MIN_ROI:
                ukey = f"{main_skin['name']}_{mode}"
                if ukey not in self.unique_best_results or roi > self.unique_best_results[ukey]['roi']:
                    self.unique_best_results[ukey] = {
                        "roi": roi, "type": mode, "main": main_skin['name'], "cond": cond,
                        "rarity": main_skin['rarity'], 
                        "filler": filler, "cost": cost, "exp": exp_val, 
                        "main_count": main_count, "max_float": max_main_real_float,
                        "space": space, "details": details,
                        "col": self.cheapest_fillers.get(f"{main_skin['rarity']}_(Factory New)", {}).get('collection', '')
                    }

    def _write_results(self):
        res = list(self.unique_best_results.values())
        if not res: print("\nKeine Ergebnisse."); return
        res.sort(key=lambda x: x['roi'], reverse=True)
        print(f"\n💾 Schreibe {len(res)} Ergebnisse...")
        try:
            with open(OUTPUT_FILENAME, "w", encoding="utf-8") as f:
                f.write(f"TRADE UP REPORT - {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Formula: New CS2 Method (Trade Floats) | ROI > {MIN_ROI}%\n")
                f.write("="*70 + "\n\n")
                for i, r in enumerate(res):
                    marker = " 🔥" if r['roi'] > 30 else ""
                    f.write(f"#{i+1} [ROI: {r['roi']:.2f}%]{marker} | {r['type']} | {r['rarity']}\n")
                    f.write(f"   Collection: {r['col']}\n")
                    f.write(f"   🛒 Main: {r['main_count']}x {r['main']} ({r['cond']})\n")
                    f.write(f"      👉 Max REAL Float: < {r['max_float']:.5f} (Puffer: {r['space']:.4f})\n")
                    if r['filler']:
                        cnt = 10 - r['main_count']
                        f.write(f"   🛒 Filler: {cnt}x {r['filler']['name']} ({r['filler']['cond']}) @ {r['filler']['price']:.2f}€\n")
                    f.write(f"   Kosten: {r['cost']:.2f}€ -> Erwartet: {r['exp']:.2f}€\n")
                    f.write("   Outcomes:\n")
                    for d in r['details']: f.write(f"{d}\n")
                    f.write("-" * 70 + "\n")
        except Exception as e: print(e)
        print("✅ Fertig.")

if __name__ == "__main__":
    bot = TradeUpBot()
    if bot.load_static_data():
        if bot.fetch_live_prices():
            bot.calculate_tradeup()
            