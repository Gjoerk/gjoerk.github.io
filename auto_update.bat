@echo off
:: 1. Gehe in den richtigen Ordner (WICHTIG: Passe den Pfad an!)
cd /d "C:\Users\Gabriel\Documents\TRADEUPENGINE"

:: 2. Führe das Python-Skript aus
echo Starte Preis-Update...
python price_update.py

:: 3. Prüfe, ob sich was geändert hat, und lade es hoch
echo Lade auf GitHub hoch...
git add prices_cache.json
git commit -m "🤖 Daily Update (vom PC)"
git push

:: Optional: Warte kurz, damit du das Fenster siehst (kannst du später entfernen)
timeout /t 20