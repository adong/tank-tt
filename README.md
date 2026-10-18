# Tank TT

[![Tank TT title screen](docs/screenshot.jpg)](https://adong.github.io/tank-tt/)

A top-down tank game for Teddy and Tommy, in the spirit of the 1980s arcade tank classics Dad grew up with, and best played together. It's built with Claude Code from plain JavaScript and Three.js, on the shared Claude Games kit.
Zombie tanks and robot tanks roll in from the top. The brothers drive their own tanks, and each one pops out of his hatch to look around. Together they guard a cookie jar at the bottom of the screen.
There are no image, model or audio files: the tanks and the arena are built from boxes, every texture is painted on a canvas, and every sound is synthesised.
It's silly, not violent: enemy tanks poof into stars, and a bonked tank goes BONK! and rolls back in a moment later.

"Tank TT" is a working title. It lives in one constant, `TT.TITLE` in `js/title.js`, and the page title, logo and end screens all follow it.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/tank-tt.html` is the whole game in one page (about 825 KB). AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name tank-tt`

On the title screen, tap your face to play alone (**TEDDY** or **TOMMY**), tap **TEDDY + TOMMY** for two players on one keyboard or one iPad, or tap **BUILD** to draw your own map. Pick 🐣 **EASY** or 🔥 **NORMAL** and any of the 16 stages first, if you like.

## Controls

| | Teddy (1P) | Tommy (2P) | Touch |
|---|---|---|---|
| drive | W A S D | ← ↑ → ↓ | the pad |
| fire | F or Space | L | the big 🏀 / ✌️ button |
| call your brother | T | Enter | tap his face |
| pause · sound | P or Esc · M | | ❚❚ · 🔊 under the stage flag |

- **Playing alone**, both key sets drive your tank, so the arrows and L work too.
- **Firing:** tap for one shell. Hold the button and it keeps firing, a little slower.
- **Driving:** the newest key held wins. Corners snap to the half-tile grid like the arcade original, so you slide neatly into one-tile gaps.
- **Title screen keys:** 1 plays Teddy, 2 Tommy, 3 both, B builds, E toggles easy, ← → pick the stage, and Enter plays again.
- **Touch:** one player gets a pad (bottom left), a fire button (bottom right) and the companion button above it. Two players on an iPad each get a pad and a fire button on their own side.

## How it works

- **The arena:** 13 × 13 tiles seen from above and tipped a little toward you, with a grey frame like the old cabinet screen.
  - 🧱 **Bricks** break a quarter at a time. A shell lined up on a tile edge takes out a half-tile strip, so a full tile takes two shots, like the original.
  - **Steel** stops shells, unless you have three stars.
  - **Water** can't be driven on, but shells fly over it.
  - **Trees** hide tanks underneath. A little 1P / 2P marker floats above a brother hiding under them.
  - **Ice** makes your tank slide on for a moment after you let go.
- **The cookie jar** sits at the bottom middle, with a TT flag on top and a half-thick ring of bricks around it.
  - If a zombie shell reaches it, the jar tips over, the cookies fly off and it's **"The zombies got the cookies!"**
  - Your own shells just bonk off the jar.
- **The tanks:**
  - Teddy's tank is blue with red stripes and fires 🏀. Tommy's is mint and fires ✌️ stars.
  - Each driver pops out of his hatch from the shoulders up, looks around (mostly up at you) and turns toward where he's driving.
- **The enemies:** each stage has 20, half zombie tanks (a cartoon zombie in the hatch) and half robot tanks (Bolt).
  - They come in four kinds:
    - **basic**: slow, 100 points.
    - **fast**: zooms, 200 points.
    - **power**: twin barrels, fast shells, 300 points.
    - **armored**: chunky, takes 4 hits and flashes colours (the colour tells you how many hits are left), 400 points.
  - They enter through three gates on the top row, a sparkle first, then the tank.
  - The panel on the right shows how many are still waiting.
  - Like the arcade, they wander, now and then head for the cookie jar or chase a player, shoot bricks in their way and fire at whatever's in front of them.
- **Flashing red tanks** carry a power-up: the 4th, 11th and 18th tank (more often on easy). Hit one and a power-up lands somewhere you can drive to.
- **Getting hit** is a cartoon BONK!, with stars and a puff. Your tank rolls back in at your start a moment later with a short shield.
  - You lose one tank and one star, not all of them.
  - At 0 tanks you're out. In two-player mode the other brother keeps going.
- **Lives and score:** you get 3 tanks on normal and 5 on easy. There's an extra tank every 20,000 points, and taking a power-up is 500.
- **Stage clear:** both brothers warp home either side of the jar, climb out of their hatches and do their signature moves as confetti falls.
  - Teddy shadow-boxes Tyson style (jab, guard, straight) and sinks a 🏀 jump shot.
  - Tommy does his Y pose with peace fingers (比耶), with happy hops.
  - Then comes the tally (kills of each kind × points, per brother). Lives, stars and score carry on to the next stage.
- **16 stages** with our own layouts get gently harder:
  - The mix moves from mostly basic tanks to more armored ones.
  - Enemies come a little faster and drive a little faster.
  - Stages 1–2 have one fewer zombie tank on screen at a time.
  - BACKYARD, TOY BLOCKS, DUCK POND, BRICK TOWN, SNOW DAY, DEEP FOREST, STEEL CASTLE, RIVER CROSSING, T FOR TEDDY & TOMMY, SMILEY, MAZE RUNNER, ICE RINK, ROBOT FACTORY, ZOMBIE PARK, COOKIE FORTRESS and BIG FINALE.
- **Game over** offers ↻ TRY AGAIN, which restarts the same stage with fresh tanks: no going back to stage 1. The stage picker remembers where you got to, and a ⭐ marks the stages you've cleared.
- **🐣 Easy:**
  - 5 tanks.
  - Zombies drive at 72% speed and their shells fly at 75%.
  - They fire about half as often and aim less.
  - More flashing tanks, and power-ups land near the tank that earned them.
  - Longer shields, freezes and steel walls.

## Power-ups

| | | |
|---|---|---|
| ⭐ | star | 1: faster shells. 2: two shells at once. 3: shells break steel. |
| 🪖 | helmet | a shield bubble for 10 s (15 s on easy) |
| 🧱 | shovel | steel walls around the cookie jar for 16 s (22 s on easy). They blink back to bricks at the end. |
| ⏰ | clock | freezes every zombie and robot tank for 10 s (12 s on easy) |
| 💣 | bomb | every enemy on screen goes POOF into stars |
| +1 | extra tank (a little tank badge) | +1 tank |

A power-up stays for 18 s and blinks before it goes.

## Call your brother (companion mode)

**Playing alone**, the other brother is your companion: Tommy for Teddy, and Teddy for Tommy (`Kit.roster.buddyFor`). Call him with T, or tap the big button with his face, as often as you like.

- **He rolls in** from the bottom edge at his own start, beside the jar, with his name tag and a golden ring around his tank.
- **He says hi** from his hatch with his signature move: Tommy does the Y pose, Teddy shadow-boxes. Then he tosses you a treat (🍦 💧 🧃 🍪 🍉 🍌) that arcs into your hatch: **"🍦 ICE CREAM FROM TOMMY!"**
- **Then he hunts** for about 10 s. He drives to the nearest zombie tank, lines up and fires his own 🏀 or ✌️ shells, shoots bricks out of his way (never the jar's ring), and his kills count for you.
  - He's a guest: shells just bounce off his tank.
- **He has your back:** while he's there, one hit on you or on the cookie jar is blocked.
  - **"TOMMY SAVED YOU!"** gives you a short shield. **"TOMMY SAVED THE COOKIES!"** sparkles at the jar.
  - The 🛡️ on his time bar greys out once he's used his save.
- **His time bar:** the HUD bar with his face shows the time left, and so does the ring around his button.
- **Tap again** once his treat has arrived ("ANOTHER TREAT?") and he says hi again, brings another treat, stays the full 10 s again and re-arms his save. Tapping before the treat arrives just keeps him there longer.
- **At the end** he does his goodbye move (Teddy's jump shot, Tommy's Y) and vanishes in a sparkle.

**With two players**, the button turns into **BROTHER POWER**: both tanks get a 4 s shield, and both brothers do their moves with a cheer. Then it rests for 20 s (12 s on easy), and its ring refills as it does.

## 🛠️ Construction mode

Tap **BUILD** (or press B). You paint on the real 3D arena.

- **Tools:** 🧱 brick, steel, 💧 water, 🌳 trees, 🧊 ice and 🧽 erase. Tap a tile or drag across several.
  - The keyboard works too: arrows move a cursor, Space paints, 1–6 pick a tool, Backspace erases and Enter plays.
- **Fixed tiles:** the three zombie gates, the two starts and the jar's corner can't be painted.
- **Three map slots** (1, 2, 3) are saved in the browser (localStorage `tankTT.maps`). Slot 1 starts with a small example.
- **TEDDY / TOMMY / BOTH** picks who plays it.
- **The check** runs after every stroke. If a zombie gate or a start gets sealed off by steel or water, the message says which one, and **🔧 FIX IT** opens a path: steel on the way turns to bricks, and water turns to ground.
- **🎲 SURPRISE** draws a random mirrored map, already made playable. **🗑️ CLEAR** asks you to tap twice.
- **▶ PLAY** plays your map with a medium mix of 20 tanks: 12 basic, 4 fast, 2 power, 2 armored.
  - Clearing it brings you back to the builder.

## Make it yours

- **`js/stages.js`** has every stage as 13 rows of 13 characters, with the legend at the top:
  - `.` open, `#` brick, `@` steel, `~` water, `%` trees, `-` ice.
  - `l r u d` and `L R U D` are half bricks and half steel.
  - Each stage also lists its `foes` mix.
  - The gates, the starts and the jar's ring are always built the same way, whatever the map says there.
  - Run `node tools/check.js` after editing.
- **`js/sim.js`** holds the numbers at the top:
  - `LEVELS`: easy and normal (tanks, enemy speed and aim, fire gaps, power-up timers, the cheer cooldown).
  - `FOES`: speed, shell speed, hits and points per kind.
  - The treats, and the companion's visit length.

## How it's tested

The rules (`js/sim.js`) and the drivers (`js/brain.js`) have no Three.js in them. The browser game and a headless check run the same code at a fixed 60 ticks a second.

```bash
node tools/check.js
```

```bash
node tools/check.js --soak --seeds=5 [--1p] [--easy]
```

- **Map check:**
  - Every map has 13 × 13 known characters and 20 foes.
  - Every zombie gate can reach the cookie jar. Bricks count as passable, since they can be shot; steel and water don't.
  - Both players' starts can reach every gate without breaking the jar's own ring.
- **Sabotage** proves the check can fail. Each of these must be caught:
  - a gate boxed in steel;
  - a water moat around the jar;
  - Teddy's start walled in;
  - a short row, and an unknown character;
  - zombie drivers who never turn when blocked (they must be reported stuck);
  - nobody driving the player tanks (the stage must not clear).
- **Soak:** the autopilot plays every stage headlessly.
  - Players can't run out of tanks and the jar can't break, so each run goes to the end.
  - It records whether the stage clears, the longest any computer tank stood still (more than 8 s counts as **stuck**), and any tank that paced inside a one-tile box for 20 s.
  - In 1P the companion is called every 14 s.
- **Last run:**
  - All 16 maps are OK, and all 7 sabotage cases were caught.
  - The soak covered 2P normal, 1P normal, 2P easy and 1P easy, 5 seeds × 16 stages each: 320 runs.
  - Every stage cleared. No tank got stuck and none paced. The longest any computer tank stood still was 4.2 s.
  - The 1P runs include companion treats, kills and saves.

**Console hooks** (`window.game`), for the browser:

```js
game.start({ players: ['teddy', 'tommy'], stage: 4, level: 'easy' })  // straight into a stage (skips the curtain)
game.step(2)            // advance 2 s and draw (the Browser pane throttles animation while hidden)
game.freeze(true)       // stop real-time ticking; game.keepAwake() stops the auto-pause when the tab hides
game.state()            // mode, players, the companion, power-up, enemies...
game.buddy()            // press the companion button
game.give('star', 0)    // give player 0 a power-up: star, helmet, shovel, clock, bomb, tank
game.power('clock')     // drop a power-up on the field
game.autopilot(true)    // let the computer drive both tanks
game.clear()            // finish the stage (celebration, then the tally)
game.peek(x, z, dist)   // close-up camera; game.peek() to go back
game.check()            // map check + sabotage; game.soak({ players: ['teddy'] }) runs the soak in the browser
```

Add `?touch=1` to the address to see the touch controls on a computer.

## Files

```
index.html       page, HUD, menus, touch controls, construction panel (CSS inline)
js/title.js      the game's name (TT.TITLE)
js/stages.js     the 16 stage maps (13 x 13 characters) and their enemy mix
js/sim.js        the rules: grid, movement, shells, bricks in quarters, enemies, power-ups, the companion, events
js/brain.js      the computer drivers: zombie/robot AI, the companion and autopilot, distance-field paths
js/check.js      map check, soak and sabotage (browser console and Node)
js/sfx.js        the game's own synth sounds and the stage-start jingle
js/art.js        canvas textures, arena, cookie jar, tanks with drivers, shells, power-ups, effects
js/editor.js     construction mode
js/game.js       renderer, camera fit, the loop, events to effects, celebration, HUD, menus, input, test hooks
tools/check.js   runs js/check.js in Node (no npm)
kit/             copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .); don't edit it here
dist/tank-tt.html   the single-page build
```

## Kit candidates

These are written here first. They're worth moving into `~/claude-games/kit` if another game wants them:

- **Hatch driver** (`addDriver` in `js/art.js`, `drive` in `js/game.js`): a Kit person cut to head and shoulders in a hatch, with a bigger head, tipped up toward a high camera, and looking around. It does signature moves from the hatch.
- **Climb-out celebration** (`updateCelebrate` in `js/game.js`): drivers grow out of the hatch to full size on top of the vehicle, then loop their roster signature moves, with Teddy's jump shot throwing a 🏀.
- **`settle(p)`**: plants the feet for standing poses (like FlaTTy Birds' `standPose`).
- **Distance-field pathing on a tile grid** (`field`, `downhill` in `js/brain.js`), with breakable walls as a cost.
- **Camera fit with view offset** (`fitCamera` in `js/game.js`): fits a tilted arena into any square of the screen, and blends the offset out when zooming in on something.
- **Comic burst textures with a word** (`burstTexture` in `js/art.js`), a sprite particle pool (`makeFx`), and DOM toasts timed by the game clock (they work in a background tab).
- **Sounds** made with `Kit.sound.tone` / `hiss` (`js/sfx.js`): tank treads, 🏀 "pung", ✌️ twinkle, brick crumble, steel ping, poof, BONK, sad wah-wah, fanfare and the jingle.

## Name ideas

Alan names the games. A few TT puns: **TanTTastic!** (tank-tastic), **ToTTally Tanks**, **BaTTalion Bros**, **CookieTT Guards**.

## Not verified

- **Sound:** every effect and the jingle are wired up, but nobody listened in this build. The test browser has no audio check.
- **Real touch devices:** touch was tested in the Browser pane with an emulated phone (375 × 812) and an iPad-sized window (1024 × 768, `?touch=1`), driving the controls through the game's own input hooks. It wasn't tried on a real iPhone or iPad.
- **Real-time feel:** play was driven with `game.step()` and short real-time runs, not long sessions with a person at the keys. Speeds and difficulty may want tuning after Teddy and Tommy try it.
