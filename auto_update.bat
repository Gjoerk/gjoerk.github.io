@echo off
:: --- EINSTELLUNGEN ---
:: HIER DEINEN ECHTEN PFAD EINTRAGEN (Beispiel: C:\Users\Max\Desktop\CS2Bot)
:: Wenn du den Pfad nicht kennst: Lösche die Zeile mit "cd /d" einfach, 
:: aber dann funktioniert die Aufgabenplanung später evtl. nicht.
cd /d "C:\Users\Gabriel\Documents\TRADEUPENGINE"

:: --- 1. LOKALE ARBEIT SICHERN ---
:: Das verhindert den "Overwritten"-Fehler. Wir speichern deine index.html erst ab.
echo Siche lokalen Stand...
git add .
git commit -m "🛡️ Auto-Save: Lokale Änderungen gesichert"

:: --- 2. GITHUB SYNCHRONISIEREN ---
:: Jetzt holen wir Änderungen von GitHub und mischen sie (Merge).
echo Hole Updates von GitHub...
git pull --no-edit origin main

:: --- 3. PREIS UPDATE ---
echo Starte Python Skript...
python price_update.py

:: --- 4. NUR PREISE HOCHLADEN ---
echo Lade Preise hoch...
git add prices_cache.json
git commit -m "🤖 Daily Price Update"
git push

:: Fertig
echo Alles erledigt.
timeout /t 20