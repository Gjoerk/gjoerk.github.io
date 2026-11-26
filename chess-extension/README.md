# Analyze on gabrielschwarz.com (Chrome extension)

One click on a chess.com game opens it in the analyzer at
[gabrielschwarz.com/chess](https://gabrielschwarz.com/chess/), which grades every move straight away.

## Install

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `chess-extension` folder.
3. Pin the pawn icon to the toolbar (puzzle-piece menu → pin).

## Use

Open any game on chess.com (its address has `/game/` in it: a finished game, the review page or
the archive) and click the pawn icon, or press **Alt+Shift+A**. A new tab opens with the analysis
running. The game is also saved under *Your games*.

## How it works

- `background.js` reads the game id from the tab address, fetches the game from chess.com's own
  game endpoint inside that tab, and rebuilds the PGN from its move list with the bundled
  `chess.js`. If that fails, it looks the game up in the player's monthly archive on
  `api.chess.com`.
- It then opens `https://gabrielschwarz.com/chess/#pgn=<PGN>&me=<you>`. The analyzer reads that
  link, clears it from the address bar, saves the game and starts the analysis. `me` is only sent
  when the signed-in chess.com user played the game, so the board is shown from your side.
- Permissions: `activeTab` + `scripting` (it only touches the tab you click on, and only when you
  click) and `api.chess.com` for the fallback lookup.

The `#pgn=` link works without the extension too: any link of that form opens the analyzer with
that game.
