# Minecrawler — design

A roguelike built on Minesweeper. It looks like the Windows 95/98 Minesweeper window: grey bevels,
red LED counters, the smiley button, a teal desktop and a taskbar. All art is 16×16 pixel art,
drawn in code, and the animations are short and simple.

## Pitch

> Minesweeper, but a mine doesn't end the game. It costs a heart. Go down ten floors, pick up gold,
> buy tools and relics, and reach the Motherlode at the bottom before your hearts run out.

Classic Minesweeper is one board where one mistake ends everything. Minecrawler turns it into a
**run** of boards:

- **Hearts instead of instant death.** A mine costs 1 HP. The mine stays uncovered and counts as
  found, and you keep playing. At 0 HP the run is over, and nothing carries over to the next run
  except unlocked characters.
- **Boards that grow.** Depth 1 is 9×9 with 10 mines. Depth 9 is 16×16 with 48 mines, and Depth 10
  is the boss floor.
- **Things hidden under tiles.** Coins, gems, hearts, item bags, and the **stairs**.
- **Clear the floor or leave early.** Every floor has stairs hidden under a safe tile. You can take
  them as soon as you uncover them, or keep sweeping to clear the floor fully, which pays a clear
  bonus, collects every item and earns the Guardian relic on Guardian floors.

## Core loop

```
Depth N board ──► clear it fully (bonus) ─┐
      │                                    ├─► Stairwell: choose 1 of 3 doors ─► Depth N+1
      └─► find stairs, leave early ────────┘     (Shop / Shrine / Chest / Gambler / Vault)
```

Every 3rd floor (3, 6, 9) is a **Guardian floor**. It always has a modifier, and clearing it fully
lets you pick 1 of 3 relics. Depth 10 is **the Mine King's Hoard**. It has no stairs, so you have
to clear it, and clearing it wins the run. After a win you can keep going in **Endless Descent**.

## Minesweeper rules (unchanged)

- Left click/tap uncovers a tile. Right click/long-press places a flag.
- Click a number whose flag count already matches it to **chord**, which uncovers its other neighbours.
- Your first click on a floor is always safe and opens an area.
- Number colours match the original: 1 blue, 2 green, 3 red, 4 navy, 5 maroon, 6 teal, 7 black, 8 grey.

## Floors

| Depth | Size  | Mines | Notes                     |
|------:|-------|------:|---------------------------|
| 1     | 9×9   | 10    | tutorial-ish              |
| 2     | 10×10 | 14    |                           |
| 3     | 11×11 | 18    | Guardian (easy modifier)  |
| 4     | 12×12 | 22    | modifiers can appear      |
| 5     | 13×12 | 26    |                           |
| 6     | 14×13 | 31    | Guardian                  |
| 7     | 15×14 | 37    |                           |
| 8     | 16×14 | 42    |                           |
| 9     | 16×16 | 48    | Guardian (two modifiers)  |
| 10    | 18×16 | 54    | Boss: Shifting + Smudged  |
| 11+   | 18×16 | +3/floor | Endless, two modifiers |

## Floor modifiers

| Modifier     | Effect                                                                    | Counter        |
|--------------|---------------------------------------------------------------------------|----------------|
| Smudged      | Some numbers show as `?`, and you can't chord on them                     | Spectacles     |
| Volatile     | Mines deal 2 damage                                                       | Shield, Boots  |
| Gold Rush    | Three times the coins                                                     | —              |
| Cave-in      | The timer counts down. At 0 the ceiling hits you (1 dmg) and it resets to 30s | Stopwatch  |
| Shifting     | Every 15s some unflagged mines move to a neighbouring tile and the numbers update (they flash). **Correct flags pin mines in place.** | Stopwatch, flags |
| Crowded      | 20% more mines, plus a guaranteed heart                                   | —              |
| Pitch Black  | Your first click opens one tile instead of an area                        | Sonar          |

## Board pickups

| Pickup    | Effect                                              |
|-----------|-----------------------------------------------------|
| Coin      | 1–3 gold                                            |
| Gem       | 8 gold                                              |
| Heart     | +1 HP (5 gold if you're already at full health)     |
| Item bag  | A random item (5 gold if your slots are full)       |
| Stairs    | Lets you descend; shown with its number in the corner |

## Items (consumables, 3 slots, keys 1–4)

| Item    | Price | Effect                                                     |
|---------|------:|------------------------------------------------------------|
| Probe   | 6     | Checks one tile safely. A mine gets flagged instead of exploding. |
| Sonar   | 12    | Uncovers a 3×3 area safely and flags the mines in it       |
| Potion  | 9     | +1 HP                                                      |
| Lantern | 7     | Shows every mine for 1.5 seconds                           |
| Shield  | 9     | Blocks the next mine you trigger                           |
| Compass | 5     | Shows where the stairs are                                 |

## Relics (passive, last for the whole run)

| Relic            | Effect                                                         |
|------------------|----------------------------------------------------------------|
| Hard Hat         | +1 max HP                                                      |
| Four-Leaf Clover | 1 in 4 mines you trigger is a dud                              |
| Gold Pan         | +50% gold from coins and gems                                  |
| Magnet           | Taking the stairs early still collects everything left on the floor |
| Canary           | 2 mines are flagged for you at the start of each floor         |
| Medkit           | +1 HP every time you fully clear a floor                       |
| Miner's Map      | The stairs are marked at the start of each floor               |
| Spectacles       | You can read smudged numbers                                   |
| Stopwatch        | Cave-in timers are 50% longer and mines shift half as often    |
| Piggy Bank       | 10% interest on your gold at every stairwell (max 15)          |
| Backpack         | +1 item slot                                                   |
| Steel-Toe Boots  | The first mine you trigger on each floor does no damage        |
| Dowsing Rod      | Every 30 tiles you uncover, one mine gets flagged              |
| Coupon           | 25% off in shops                                               |

## Stairwell doors

- **Shop:** 4 items, 1 relic, and healing for 10 gold.
- **Shrine:** pick one: *Pray* (heal to full), *Offer blood* (−1 max HP for a random relic) or
  *Tithe* (20 gold for +1 max HP).
- **Chest:** gold and an item, with a 20% chance of a relic.
- **Gambler:** *Double or nothing* on half your gold, or a 10-gold mystery bag.
- **Vault:** the next floor has 25% more mines, three times the coins and two gems.

After Depth 9 the doors are always Shop and Shrine, so you can prepare for the boss.

## Characters (meta-progression)

| Character      | HP | Start kit                                    | Unlock            |
|----------------|---:|----------------------------------------------|-------------------|
| The Sweeper    | 3  | Probe                                        | —                 |
| The Prospector | 2  | Gold Pan, Compass, 15 gold                   | Reach Depth 4     |
| The Engineer   | 2  | Backpack, Sonar, Probe, Lantern              | Reach Depth 7     |
| The Daredevil  | 1  | Clover, Steel-Toe Boots, double gold         | Win a run         |

**Daily Dig:** a seeded run that's the same for everyone on a given date. It uses The Sweeper,
and your best daily score is saved.

## Score

`gold earned + 50 × (depth − 1) + 25 × floors fully cleared + (win ? 500 + 50 × HP left : 0)`

The top 10 runs go in the **Hall of Fame**, a nod to the "Fastest Mine Sweepers" dialog.

## Look & feel

- A teal Win95 desktop with a draggable-looking window: navy gradient title bar, a menu bar
  (*Game*, *Help*), bevelled panels and a status bar.
- The classic header: mine counter LED, smiley button and timer LED (it counts down on Cave-in floors).
- Smiley faces: normal, "oh" while you hold the mouse down, hurt (`> <`) when you take damage,
  sunglasses when you clear a floor, X eyes when you die, and an angry face on the boss floor.
- A taskbar with a Start button, a task button and a clock. Minimise works, and the close button jokes.
- The whole window scales up in whole and half steps so the pixels stay crisp.

### Animations

- **Cascade reveal:** tiles pop open in waves outward from your click (about 28 ms per step).
- **Pressed tiles:** a held tile looks pushed in, and so do a number's neighbours while you hold it to chord.
- **Flag drop:** flags drop in with a small bounce.
- **Explosion:** an expanding pixel fireball, debris particles, a screen shake and the red tile
  behind the mine. Duds only give a grey puff of smoke.
- **Pickups:** a floating icon and "+3" text that rise and fade.
- **Hearts:** a heart shakes and empties when you lose it.
- **Shifting:** the board rumbles and changed numbers flash yellow.
- **Floor banner:** "DEPTH 4" and the modifier names slide across the board.
- **Lantern:** every mine blinks in see-through.

### Sound

Small WebAudio blips for a click, a cascade, a flag, a coin and a purchase, a noise burst for an
explosion, a rumble for shifting and a short fanfare for a clear. You can turn sound off in the Game menu.

## Persistence

`localStorage` keeps the run in progress (the exact board, saved after every move, so reloading
doesn't reroll a floor), unlocks, the Hall of Fame, daily bests and the sound setting.

## Ideas for later

- Monster tiles: special mines that deal more damage, and whose number tiles are tinted.
- Curses picked up from Gambler losses.
- Events in the stairwell: a trapped miner, a cursed idol.
- More bosses: a Mimic floor, where some numbers lie by ±1.
- A weekly challenge with fixed relics.
