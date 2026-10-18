/* Tank TT: the rules of the game. There is no Three.js in here, so the browser game and the headless check
   (tools/check.js) run the very same code.

   Units: the arena is 26 x 26 cells. A map tile is 2 x 2 cells, which is how a brick tile breaks a quarter at a time.
   A tank is 2 x 2 cells; its position (x, y) is its top-left corner, and y grows downwards, toward the cookie jar.
   Tanks move along one axis at a time. Turning a corner snaps the tank to the nearest whole cell, like the
   arcade original, so a tank always lines up with one-tile gaps.

   The renderer reads the state (S.tanks, S.shells, S.grid...) and drains S.events for effects and sounds. */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});

  const N = 26;
  const EMPTY = 0, BRICK = 1, STEEL = 2, WATER = 3, TREES = 4, ICE = 5, BASE = 6;
  const BLOCKS_TANK = [0, 1, 1, 1, 0, 0, 1];
  const BLOCKS_SHELL = [0, 1, 1, 0, 0, 0, 1];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
  const EPS = 1e-6;

  // Each map character fills a tile's quarters: [top-left, top-right, bottom-left, bottom-right].
  const B = BRICK, St = STEEL, _ = EMPTY;
  const TILES = {
    '.': [_, _, _, _], '#': [B, B, B, B], '@': [St, St, St, St],
    '~': [WATER, WATER, WATER, WATER], '%': [TREES, TREES, TREES, TREES], '-': [ICE, ICE, ICE, ICE],
    l: [B, _, B, _], r: [_, B, _, B], u: [B, B, _, _], d: [_, _, B, B],
    L: [St, _, St, _], R: [_, St, _, St], U: [St, St, _, _], D: [_, _, St, St],
    '*': [_, _, _, _], 1: [_, _, _, _], 2: [_, _, _, _], E: [_, _, _, _],
  };

  // The fixed parts of every arena.
  const BASE_X = 12, BASE_Y = 24; // the cookie jar: cells 12-13, rows 24-25
  const RING = [[11, 23], [12, 23], [13, 23], [14, 23], [11, 24], [14, 24], [11, 25], [14, 25]];
  const RING_TILES = [[5, 11], [6, 11], [7, 11], [5, 12], [7, 12]];
  const PLAYER_SPAWN = { teddy: [8, 24], tommy: [16, 24] }; // either side of the jar
  const FOE_SPAWN = [[12, 0], [24, 0], [0, 0]]; // middle, right, left, in turn
  // Where a zombie tank parks to shoot at the jar: above it, or beside it.
  const BASE_GOALS = [[11, 22, 2], [12, 22, 2], [13, 22, 2], [10, 23, 1], [10, 24, 1], [14, 23, 3], [14, 24, 3]];

  const LEVELS = {
    easy: {
      tanks: 5, foeSpeed: 0.72, foeShell: 0.75, fireGap: [1.8, 3.6], aim: 0.3, spawnGap: 4.2, maxOn: 3,
      powerAt: [2, 5, 8, 11, 14, 17], helmet: 15, freeze: 12, shovel: 22, spawnShield: 4, cheerCool: 12,
      slide: 0.25, baseMood: 0.5, playerShell: 1,
    },
    normal: {
      tanks: 3, foeSpeed: 1, foeShell: 1, fireGap: [1.0, 2.4], aim: 0.65, spawnGap: 3.2, maxOn: 4,
      powerAt: [3, 10, 17], helmet: 10, freeze: 10, shovel: 16, spawnShield: 3, cheerCool: 20,
      slide: 0.4, baseMood: 1, playerShell: 1,
    },
  };
  const FOES = {
    basic: { speed: 3.4, shell: 12, hp: 1, points: 100 },
    fast: { speed: 6.6, shell: 12, hp: 1, points: 200 },
    power: { speed: 4.0, shell: 20, hp: 1, points: 300 },
    armor: { speed: 3.2, shell: 13, hp: 4, points: 400 },
  };
  const FOE_ORDER = ['basic', 'fast', 'power', 'armor'];
  const PLAYER_SPEED = 5.6;
  const POWERS = ['star', 'helmet', 'shovel', 'clock', 'bomb', 'tank'];
  const POWER_WEIGHT = { star: 3, helmet: 2, shovel: 2, clock: 2, bomb: 2, tank: 1 };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const VISIT = 10, HELLO = 2.0, BYE = 1.3; // the companion's visit, his hello and his goodbye, in seconds
  const LIFE_EVERY = 20000;

  // Small seeded random generator, so a check run can be repeated exactly.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- maps

  function setTile(grid, tx, ty, q) {
    const i = 2 * ty * N + 2 * tx;
    grid[i] = q[0];
    grid[i + 1] = q[1];
    grid[i + N] = q[2];
    grid[i + N + 1] = q[3];
  }

  function clearBox(grid, x, y) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) grid[(y + dy) * N + x + dx] = EMPTY;
  }

  // The parts every arena shares: open gates and starts, the cookie jar and its half-thick brick ring.
  function fixedParts(grid) {
    for (const [x, y] of FOE_SPAWN) clearBox(grid, x, y);
    for (const k in PLAYER_SPAWN) clearBox(grid, PLAYER_SPAWN[k][0], PLAYER_SPAWN[k][1]);
    for (const [tx, ty] of RING_TILES) setTile(grid, tx, ty, TILES['.']);
    for (const [x, y] of RING) grid[y * N + x] = BRICK;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) grid[(BASE_Y + dy) * N + BASE_X + dx] = BASE;
  }

  function parseMap(rows) {
    const grid = new Uint8Array(N * N), problems = [];
    if (!rows || rows.length !== 13) problems.push(`needs 13 rows, has ${rows ? rows.length : 0}`);
    for (let ty = 0; ty < 13; ty++) {
      const row = (rows && rows[ty]) || '';
      if (rows && rows[ty] !== undefined && row.length !== 13) problems.push(`row ${ty + 1} has ${row.length} characters, needs 13`);
      for (let tx = 0; tx < 13; tx++) {
        const ch = row[tx] || '.';
        const q = TILES[ch];
        if (!q) problems.push(`unknown character "${ch}" in row ${ty + 1}, column ${tx + 1}`);
        setTile(grid, tx, ty, q || TILES['.']);
      }
    }
    fixedParts(grid);
    return { grid, problems };
  }

  // Tiles the editor and the fixed parts own: the gates, the starts, the jar and its ring.
  function fixedTile(tx, ty) {
    if (ty === 0 && (tx === 0 || tx === 6 || tx === 12)) return '*';
    if (ty === 12 && tx === 4) return '1';
    if (ty === 12 && tx === 8) return '2';
    if (ty === 12 && tx === 6) return 'E';
    if (RING_TILES.some(([x, y]) => x === tx && y === ty)) return '#';
    return null;
  }

  // ---------------------------------------------------------------- the game

  // opts: { stage: { name, map, foes }, stageNo, players: ['teddy'] or ['teddy', 'tommy'], level: 'easy' | 'normal',
  //         seed, carry: [{ reserve, star, score }], auto: [bool, bool] (autopilot, for the demo and the check),
  //         test: { infinite, immortalBase, lazy } }
  function create(opts) {
    const L = LEVELS[opts.level] || LEVELS.normal;
    const rand = rng(opts.seed || 1);
    const parsed = parseMap(opts.stage.map);
    const stageNo = opts.stageNo || 1;
    const two = opts.players.length === 2;
    const S = {
      N, L, rand, level: opts.level || 'normal', stage: opts.stage, stageNo, two,
      grid: parsed.grid, problems: parsed.problems, gridVer: 1,
      t: 0, tanks: [], shells: [], events: [], sparkles: [], power: null,
      freezeT: 0, shovelT: 0, buddy: null, cheerCool: 0, cheerT: 0,
      baseAlive: true, over: null, overT: 0, cleared: false, clearT: 0,
      queue: lineup(opts.stage.foes, rand, L, stageNo), total: 20, spawnT: 1.0, spawnIdx: 0, nextId: 1, killed: 0, treatIdx: 0,
      foeSpeed: L.foeSpeed * (1 + 0.012 * (stageNo - 1)),
      spawnGap: L.spawnGap * Math.max(0.72, 1 - 0.02 * (stageNo - 1)),
      maxOn: L.maxOn + (two ? 1 : 0) - (stageNo <= 2 ? 1 : 0),
      input: [{ dir: null, fire: false, press: false }, { dir: null, fire: false, press: false }],
      auto: opts.auto || [false, false],
      test: Object.assign({ infinite: false, immortalBase: false, lazy: false }, opts.test || {}),
      stats: { baseHits: 0, saves: 0, maxStill: 0, stuck: [], pacing: [], shots: 0, treats: 0, buddyKills: 0 },
    };
    S.players = opts.players.map((kind, i) => {
      const c = (opts.carry && opts.carry[i]) || {};
      return {
        i, kind, spawn: PLAYER_SPAWN[kind] || PLAYER_SPAWN.teddy,
        reserve: c.reserve !== undefined ? c.reserve : L.tanks - 1,
        star: c.star || 0, score: c.score || 0,
        nextLife: (Math.floor((c.score || 0) / LIFE_EVERY) + 1) * LIFE_EVERY,
        kills: { basic: 0, fast: 0, power: 0, armor: 0 }, tank: null, respawnT: 0, out: false,
      };
    });
    S.buddyKind = two ? null : S.players[0].kind === 'tommy' ? 'teddy' : 'tommy';

    const emit = (type, data) => S.events.push(Object.assign({ type, t: S.t }, data));
    S.emit = emit;

    function makeTank(o) {
      return Object.assign({
        id: S.nextId++, x: 0, y: 0, dir: 0, moving: false, blocked: false, hp: 1, shield: 0, flash: false,
        cool: 0, shellsOut: 0, slide: 0, alive: true, born: S.t, want: null, go: false, wantFire: false,
        stillT: 0, lastX: o.x, lastY: o.y, win: { t0: S.t, x0: o.x, x1: o.x, y0: o.y, y1: o.y }, flagged: false,
        tread: 0, fireHeld: 0,
      }, o);
    }

    function shellStats(t, star) {
      t.star = star;
      t.shellSpeed = (star >= 1 ? 22 : 14) * L.playerShell;
      t.maxShells = star >= 2 ? 2 : 1;
      t.shellPower = star >= 3 ? 3 : 0;
    }

    function spawnPlayer(P) {
      const [x, y] = P.spawn;
      const t = makeTank({
        team: 'ally', kind: P.kind, variant: 'player', player: P.i, x, y, dir: 0, speed: PLAYER_SPEED,
        shield: L.spawnShield, shellKind: P.kind === 'tommy' ? 'peace' : 'ball',
      });
      shellStats(t, P.star);
      P.tank = t;
      S.tanks.push(t);
      emit('playerIn', { tank: t });
    }
    S.players.forEach(spawnPlayer);

    // ---------------- grid helpers

    const cell = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? STEEL : S.grid[y * N + x]);
    const tankOn = (t, x, y) => x >= Math.floor(t.x + EPS) && x <= Math.ceil(t.x + 2 - EPS) - 1 && y >= Math.floor(t.y + EPS) && y <= Math.ceil(t.y + 2 - EPS) - 1;

    function setCell(x, y, v) {
      if (S.grid[y * N + x] === v) return;
      S.grid[y * N + x] = v;
      S.gridVer++;
    }

    function setRing(type) {
      for (const [x, y] of RING) {
        if (S.tanks.some((t) => t.alive && tankOn(t, x, y))) continue; // never wall a tank in
        setCell(x, y, type);
      }
      emit('grid', {});
    }

    function onIce(t) {
      let n = 0;
      for (let y = Math.floor(t.y + EPS); y <= Math.ceil(t.y + 2 - EPS) - 1; y++)
        for (let x = Math.floor(t.x + EPS); x <= Math.ceil(t.x + 2 - EPS) - 1; x++) if (cell(x, y) === ICE) n++;
      return n >= 2;
    }

    // ---------------- movement

    // How far t can go along its heading, up to `want`: stops at walls, the arena edge and other tanks.
    function room(t, want) {
      const [dx, dy] = DIRS[t.dir];
      let d = want;
      if (!t.ghost) {
        if (dx > 0) d = Math.min(d, N - 2 - t.x);
        else if (dx < 0) d = Math.min(d, t.x);
        else if (dy > 0) d = Math.min(d, N - 2 - t.y);
        else d = Math.min(d, t.y);
        if (d <= EPS) return 0;
        // walls: look at each new column (or row) the front edge would enter
        if (dx !== 0) {
          const y0 = Math.floor(t.y + EPS), y1 = Math.ceil(t.y + 2 - EPS) - 1;
          const front = dx > 0 ? t.x + 2 : t.x;
          for (let k = 0; k < 3; k++) {
            const c = dx > 0 ? Math.ceil(front - EPS) + k : Math.floor(front + EPS) - 1 - k;
            const gap = dx > 0 ? c - front : front - (c + 1);
            if (gap >= d) break;
            let hit = false;
            for (let y = y0; y <= y1; y++) if (BLOCKS_TANK[cell(c, y)]) hit = true;
            if (hit) { d = Math.max(0, gap); break; }
          }
        } else {
          const x0 = Math.floor(t.x + EPS), x1 = Math.ceil(t.x + 2 - EPS) - 1;
          const front = dy > 0 ? t.y + 2 : t.y;
          for (let k = 0; k < 3; k++) {
            const r = dy > 0 ? Math.ceil(front - EPS) + k : Math.floor(front + EPS) - 1 - k;
            const gap = dy > 0 ? r - front : front - (r + 1);
            if (gap >= d) break;
            let hit = false;
            for (let x = x0; x <= x1; x++) if (BLOCKS_TANK[cell(x, r)]) hit = true;
            if (hit) { d = Math.max(0, gap); break; }
          }
        }
      }
      // other tanks: stop at their edge; tanks that already overlap may only move apart
      if (!t.ghost) {
        for (const o of S.tanks) {
          if (o === t || !o.alive || o.ghost) continue;
          if (dx !== 0) {
            if (!(t.y < o.y + 2 - EPS && o.y < t.y + 2 - EPS)) continue;
            const ahead = dx > 0 ? o.x - t.x : t.x - o.x;
            if (ahead > EPS) d = Math.min(d, Math.max(0, ahead - 2));
          } else {
            if (!(t.x < o.x + 2 - EPS && o.x < t.x + 2 - EPS)) continue;
            const ahead = dy > 0 ? o.y - t.y : t.y - o.y;
            if (ahead > EPS) d = Math.min(d, Math.max(0, ahead - 2));
          }
        }
        // a spawning tank's sparkle is solid too, so nobody parks on it
        for (const sp of S.sparkles) {
          if (dx !== 0) {
            if (!(t.y < sp.y + 2 - EPS && sp.y < t.y + 2 - EPS)) continue;
            const ahead = dx > 0 ? sp.x - t.x : t.x - sp.x;
            if (ahead > EPS) d = Math.min(d, Math.max(0, ahead - 2));
          } else {
            if (!(t.x < sp.x + 2 - EPS && sp.x < t.x + 2 - EPS)) continue;
            const ahead = dy > 0 ? sp.y - t.y : t.y - sp.y;
            if (ahead > EPS) d = Math.min(d, Math.max(0, ahead - 2));
          }
        }
      }
      return Math.max(0, d);
    }

    function advance(t, want) {
      const d = room(t, want);
      const [dx, dy] = DIRS[t.dir];
      t.x += dx * d;
      t.y += dy * d;
      t.tread += d;
      t.blocked = d < want - EPS;
      return d;
    }

    function turn(t, dir) {
      if (dir === t.dir) return;
      if ((dir & 1) !== (t.dir & 1)) {
        if (t.dir & 1) t.x = Math.round(t.x); // was moving sideways: line up on a whole column
        else t.y = Math.round(t.y);
      }
      t.dir = dir;
    }

    // Computer-driven tanks stop on every whole cell so their brain can choose a new way at each junction.
    function driveAI(t, dt) {
      let left = t.speed * dt;
      t.blocked = false;
      for (let guard = 0; guard < 6 && left > EPS; guard++) {
        if (t.want === null || t.want === undefined) { t.moving = false; return; }
        turn(t, t.want);
        if (!t.go) { t.moving = false; return; }
        const along = t.dir & 1 ? t.x : t.y;
        const sgn = t.dir === 1 || t.dir === 2 ? 1 : -1;
        const toNode = sgn > 0 ? Math.ceil(along + EPS) - along : along - Math.floor(along - EPS);
        const step = Math.min(left, toNode);
        const m = advance(t, step);
        left -= step;
        t.moving = m > EPS;
        if (m < step - EPS) { t.blocked = true; return; }
        if (Math.abs(m - toNode) < 1e-4) {
          if (t.dir & 1) t.x = Math.round(t.x); else t.y = Math.round(t.y);
          if (TT.brain) TT.brain.node(S, t);
        }
      }
    }

    function drivePlayer(t, inp, dt) {
      if (inp.dir !== null && inp.dir !== undefined) {
        turn(t, inp.dir);
        advance(t, t.speed * dt);
        t.moving = true;
        t.slide = onIce(t) ? L.slide : 0;
      } else if (t.slide > 0) {
        t.slide -= dt;
        advance(t, t.speed * dt);
        t.moving = true;
        if (t.blocked) t.slide = 0;
      } else {
        t.moving = false;
        t.blocked = false;
      }
    }

    // ---------------- shooting

    function fire(t) {
      if (t.shellsOut >= (t.maxShells || 1) || t.cool > 0) return false;
      const [dx, dy] = DIRS[t.dir];
      S.shells.push({
        id: S.nextId++, x: t.x + 1 + dx, y: t.y + 1 + dy, px: 0, py: 0, dir: t.dir, speed: t.shellSpeed,
        owner: t, team: t.team, power: t.shellPower || 0, kind: t.shellKind, alive: true, born: S.t,
      });
      t.shellsOut++;
      t.cool = t.team === 'ally' ? 0.1 : 0.25;
      if (t.team === 'ally') S.stats.shots++;
      emit('shot', { tank: t });
      return true;
    }

    const killShell = (s) => {
      if (!s.alive) return;
      s.alive = false;
      s.owner.shellsOut = Math.max(0, s.owner.shellsOut - 1);
    };

    // The shell's nose has reached a new row or column: what's there? A shell is as wide as a tile (2 cells),
    // so lined up on a tile edge it takes out a whole half-tile strip of bricks, like the original.
    function shellWorld(s) {
      const [dx, dy] = DIRS[s.dir];
      const tipX = s.x + dx * 0.25, tipY = s.y + dy * 0.25;
      const hits = [];
      if (dx !== 0) {
        const c = Math.floor(tipX - dx * EPS);
        if (c < 0 || c >= N) { killShell(s); emit('edge', { x: s.x, y: s.y, shell: s }); return true; }
        for (let r = Math.floor(s.y - 1 + EPS); r <= Math.ceil(s.y + 1 - EPS) - 1; r++) if (r >= 0 && r < N && BLOCKS_SHELL[S.grid[r * N + c]]) hits.push([c, r]);
      } else {
        const r = Math.floor(tipY - dy * EPS);
        if (r < 0 || r >= N) { killShell(s); emit('edge', { x: s.x, y: s.y, shell: s }); return true; }
        for (let c = Math.floor(s.x - 1 + EPS); c <= Math.ceil(s.x + 1 - EPS) - 1; c++) if (c >= 0 && c < N && BLOCKS_SHELL[S.grid[r * N + c]]) hits.push([c, r]);
      }
      if (!hits.length) return false;
      let steel = false, brick = false, base = false;
      for (const [x, y] of hits) {
        const v = S.grid[y * N + x];
        if (v === BRICK) { setCell(x, y, EMPTY); brick = true; emit('brick', { x, y, shell: s }); }
        else if (v === STEEL) {
          if (s.power >= 3) { setCell(x, y, EMPTY); emit('steelBreak', { x, y, shell: s }); } else steel = true;
        } else if (v === BASE) base = true;
      }
      if (steel) emit('steel', { x: s.x, y: s.y, shell: s });
      if (base) hitBase(s);
      if (brick || steel || base) emit('grid', {});
      killShell(s);
      return true;
    }

    function hitBase(s) {
      if (!S.baseAlive) return;
      if (s.team !== 'enemy') { emit('baseBonk', { x: s.x, y: s.y }); return; } // your own shells just bonk off the jar
      if (S.buddy && S.buddy.save) {
        S.buddy.save = false;
        S.stats.saves++;
        emit('buddySave', { what: 'base', buddy: S.buddy.tank });
        return;
      }
      S.stats.baseHits++;
      if (S.test.immortalBase) { emit('baseBonk', { x: s.x, y: s.y }); return; }
      S.baseAlive = false;
      emit('baseLost', {});
      endGame('base');
    }

    function shellTanks(s) {
      for (const o of S.tanks) {
        if (!o.alive || o.ghost || o.team === s.team) continue;
        const m = o.team === 'ally' && !o.buddy ? 0.2 : 0; // players get a slightly smaller target
        if (s.x + 0.3 > o.x + m && s.x - 0.3 < o.x + 2 - m && s.y + 0.3 > o.y + m && s.y - 0.3 < o.y + 2 - m) {
          killShell(s);
          if (o.team === 'enemy') hitFoe(o, s.owner);
          else hitAlly(o, s);
          return true;
        }
      }
      return false;
    }

    function hitFoe(o, by) {
      if (o.flash) { o.flash = false; dropPower(by); }
      o.hp--;
      if (o.hp > 0) { emit('foeHit', { tank: o, by }); return; }
      killFoe(o, by, 'shot');
    }

    function killFoe(o, by, how) {
      o.alive = false;
      S.killed++;
      let points = 0;
      const P = by && by.team === 'ally' ? S.players[by.buddy ? 0 : by.player] : null;
      if (P && how === 'shot') {
        points = FOES[o.variant].points;
        P.kills[o.variant]++;
        addScore(P, points);
        if (by.buddy) S.stats.buddyKills++;
      }
      emit('foeDown', { tank: o, by, how, points });
    }

    function addScore(P, n) {
      P.score += n;
      while (P.score >= P.nextLife) {
        P.nextLife += LIFE_EVERY;
        P.reserve++;
        emit('extraLife', { player: P.i, why: 'score' });
      }
    }

    function hitAlly(o, s) {
      if (o.buddy) { emit('buddyBonk', { tank: o }); return; } // he's a guest: shells bounce off his tank
      if (o.shield > 0) { emit('shieldBlock', { tank: o }); return; }
      if (S.buddy && S.buddy.save) {
        S.buddy.save = false;
        S.stats.saves++;
        o.shield = 1.5;
        emit('buddySave', { what: 'you', tank: o, buddy: S.buddy.tank });
        return;
      }
      poofPlayer(o);
    }

    function poofPlayer(o) {
      const P = S.players[o.player];
      o.alive = false;
      P.tank = null;
      P.star = Math.max(0, P.star - 1); // a bump costs one star, not all of them
      emit('allyDown', { tank: o });
      if (S.test.infinite || P.reserve > 0) {
        if (!S.test.infinite) P.reserve--;
        P.respawnT = 1.3;
      } else {
        P.out = true;
        emit('playerOut', { player: P.i });
        if (S.players.every((q) => q.out)) endGame('tanks');
      }
    }

    function endGame(why) {
      if (S.over || S.cleared) return;
      S.over = why;
      S.overT = 0;
      emit('over', { why });
    }

    function moveShells(dt) {
      for (const s of S.shells) {
        s.px = s.x;
        s.py = s.y;
        if (!s.alive) continue;
        const [dx, dy] = DIRS[s.dir];
        const dist = s.speed * dt, steps = Math.max(1, Math.ceil(dist / 0.35));
        for (let k = 0; k < steps && s.alive; k++) {
          s.x += (dx * dist) / steps;
          s.y += (dy * dist) / steps;
          if (shellWorld(s)) break;
          if (shellTanks(s)) break;
        }
      }
      // shells from opposite sides that meet cancel out with a pop (checked along their whole path this frame)
      const live = S.shells.filter((s) => s.alive);
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j];
          if (!a.alive || !b.alive || a.team === b.team) continue;
          if (sweptMeet(a, b)) {
            killShell(a);
            killShell(b);
            emit('pop', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          }
        }
      }
      S.shells = S.shells.filter((s) => s.alive);
    }

    function sweptMeet(a, b) {
      let lo = 0, hi = 1;
      for (const k of ['x', 'y']) {
        const p0 = (k === 'x' ? a.px - b.px : a.py - b.py), p1 = (k === 'x' ? a.x - b.x : a.y - b.y);
        const v = p1 - p0, r = 0.6;
        if (Math.abs(v) < 1e-9) { if (Math.abs(p0) >= r) return false; continue; }
        let t0 = (-r - p0) / v, t1 = (r - p0) / v;
        if (t0 > t1) [t0, t1] = [t1, t0];
        lo = Math.max(lo, t0);
        hi = Math.min(hi, t1);
        if (lo > hi) return false;
      }
      return true;
    }

    // ---------------- power-ups

    // Open tiles a player can drive to (without breaking bricks if there are enough of those), away from the jar.
    function powerSpots() {
      const pick = (reach) => {
        const spots = [];
        for (let ty = 0; ty < 13; ty++) {
          for (let tx = 0; tx < 13; tx++) {
            if (ty >= 10 && tx >= 4 && tx <= 8) continue; // not right by the jar
            const x = 2 * tx, y = 2 * ty;
            let ok = true;
            for (let k = 0; k < 4 && ok; k++) if (BLOCKS_TANK[cell(x + (k & 1), y + (k >> 1))]) ok = false;
            if (ok && reach && !reach[y * 25 + x]) ok = false;
            if (ok) spots.push([x, y]);
          }
        }
        return spots;
      };
      if (!TT.brain) return pick(null);
      const open = pick(TT.brain.reachable(S, false));
      return open.length >= 8 ? open : pick(TT.brain.reachable(S, true));
    }

    function dropPower(by) {
      const spots = powerSpots();
      if (!spots.length) return;
      let pool = spots;
      // easy: land it near the tank that earned it
      if (S.level === 'easy' && by && by.alive) {
        const near = spots.filter(([x, y]) => Math.abs(x - by.x) + Math.abs(y - by.y) <= 12);
        if (near.length) pool = near;
      }
      const [x, y] = pool[Math.floor(S.rand() * pool.length)];
      let total = 0;
      const w = POWERS.map((p) => (total += POWER_WEIGHT[p] + (p === 'tank' && S.level === 'easy' ? 1 : 0)));
      const r = S.rand() * total;
      const type = POWERS[w.findIndex((v) => r < v)];
      S.power = { type, x, y, t: 18 };
      emit('powerUp', { power: S.power });
    }

    function takePower(P, t) {
      const pw = S.power;
      S.power = null;
      addScore(P, 500);
      if (pw.type === 'star') { P.star = Math.min(3, P.star + 1); shellStats(t, P.star); }
      else if (pw.type === 'helmet') t.shield = Math.max(t.shield, L.helmet);
      else if (pw.type === 'shovel') { S.shovelT = L.shovel; setRing(STEEL); }
      else if (pw.type === 'clock') S.freezeT = L.freeze;
      else if (pw.type === 'bomb') { for (const o of S.tanks) if (o.alive && o.team === 'enemy') killFoe(o, t, 'bomb'); }
      else if (pw.type === 'tank') { P.reserve++; emit('extraLife', { player: P.i, why: 'power' }); }
      emit('powerGot', { power: pw, player: P.i, tank: t, star: P.star });
    }

    // ---------------- zombie and robot tanks

    function lineup(counts, r, Lv, no) {
      const c = (counts || [20, 0, 0, 0]).slice(0, 4);
      let sum = c.reduce((a, b) => a + b, 0);
      while (sum < 20) { c[0]++; sum++; }
      while (sum > 20) { const k = c.findIndex((v) => v > 0); c[k]--; sum--; }
      const rank = { basic: 0, fast: 1, power: 1.4, armor: 2.2 };
      const list = [];
      FOE_ORDER.forEach((v, i) => { for (let k = 0; k < c[i]; k++) list.push({ variant: v, key: rank[v] * 4 + r() * 9 }); });
      list.sort((a, b) => a.key - b.key);
      const flip = no % 2;
      return list.map((o, i) => ({ variant: o.variant, kind: (i + flip) % 2 ? 'robot' : 'zombie', flash: Lv.powerAt.includes(i), n: i }));
    }

    function spawnFoes(dt) {
      for (const sp of S.sparkles) sp.t -= dt;
      for (const sp of S.sparkles.filter((s) => s.t <= 0)) {
        const v = FOES[sp.spec.variant];
        const t = makeTank({
          team: 'enemy', kind: sp.spec.kind, variant: sp.spec.variant, x: sp.x, y: sp.y, dir: 2, n: sp.spec.n,
          speed: v.speed * S.foeSpeed, hp: v.hp, maxHp: v.hp, flash: sp.spec.flash,
          shellSpeed: v.shell * L.foeShell, maxShells: 1, shellPower: 0, shellKind: sp.spec.kind === 'robot' ? 'zap' : 'goo',
          want: 2, go: true,
        });
        S.tanks.push(t);
        emit('foeIn', { tank: t });
      }
      S.sparkles = S.sparkles.filter((s) => s.t > 0);
      if (S.over) return;
      S.spawnT -= dt;
      const onField = S.tanks.filter((t) => t.alive && t.team === 'enemy').length + S.sparkles.length;
      if (S.spawnT > 0 || !S.queue.length || onField >= S.maxOn) return;
      for (let k = 0; k < 3; k++) {
        const idx = (S.spawnIdx + k) % 3;
        const [x, y] = FOE_SPAWN[idx];
        const busy = S.tanks.some((t) => t.alive && !t.ghost && Math.abs(t.x - x) < 2 && Math.abs(t.y - y) < 2) ||
          S.sparkles.some((s) => s.x === x && s.y === y);
        if (busy) continue;
        S.sparkles.push({ x, y, t: 1.0, spec: S.queue.shift() });
        S.spawnIdx = (idx + 1) % 3;
        S.spawnT = S.spawnGap;
        emit('sparkle', { x, y });
        return;
      }
      S.spawnT = 0.3; // every gate is busy: try again soon
    }

    // ---------------- the companion: the other brother

    // 1 player: his tank rolls in from the bottom edge and helps for about 10 s. 2 players: a shield for both tanks.
    function callBuddy() {
      if (S.over || S.cleared) return { ok: false };
      if (S.two) {
        if (S.cheerCool > 0) { emit('cheerNo', {}); return { ok: false, cool: S.cheerCool }; }
        for (const P of S.players) if (P.tank && P.tank.alive) P.tank.shield = Math.max(P.tank.shield, 4);
        S.cheerCool = L.cheerCool;
        S.cheerT = 2.2;
        emit('cheer', {});
        return { ok: true, cheer: true };
      }
      const b = S.buddy;
      if (!b) {
        const [sx] = PLAYER_SPAWN[S.buddyKind];
        const t = makeTank({
          team: 'ally', kind: S.buddyKind, variant: 'player', buddy: true, x: sx, y: N + 0.6, dir: 0,
          speed: PLAYER_SPEED * 0.95, ghost: true, shellKind: S.buddyKind === 'tommy' ? 'peace' : 'ball',
        });
        shellStats(t, 1);
        S.tanks.push(t);
        S.buddy = { tank: t, phase: 'enter', left: VISIT, save: true, helloT: 0, treatT: -1, byeT: 0, visits: 1 };
        emit('buddyIn', { tank: t });
        return { ok: true, arrived: true };
      }
      if (b.phase === 'bye') { // called back while waving goodbye: he stays for another round
        b.phase = 'hunt';
        b.byeT = 0;
      }
      b.left = VISIT;
      if (b.treatT < 0 && b.phase !== 'enter') { // his last treat is delivered: another hello, another treat
        b.helloT = HELLO;
        b.treatT = 0.55;
        b.save = true;
        b.visits++;
        emit('buddyHello', { tank: b.tank, again: true });
      }
      return { ok: true, again: true };
    }

    function giveTreat(b) {
      const [emoji, name] = TREATS[S.treatIdx++ % TREATS.length];
      const P = S.players[0];
      S.stats.treats++;
      emit('treat', { emoji, name, from: b.tank, to: P.tank, who: S.buddyKind });
    }

    function updateBuddy(dt) {
      const b = S.buddy;
      if (!b) return;
      const t = b.tank;
      if (b.helloT > 0) b.helloT -= dt;
      if (b.treatT >= 0) {
        b.treatT -= dt;
        if (b.treatT < 0) { b.treatT = -1; giveTreat(b); }
      }
      if (b.phase === 'enter') {
        t.dir = 0;
        t.y -= t.speed * dt;
        t.moving = true;
        if (t.y <= N - 2) {
          t.y = N - 2;
          t.ghost = false;
          t.moving = false;
          b.phase = 'hello';
          b.helloT = HELLO;
          b.treatT = 0.55;
          emit('buddyHello', { tank: t });
        }
        return;
      }
      if (b.phase === 'hello') {
        if (b.helloT <= 0) b.phase = 'hunt';
        return;
      }
      if (b.phase === 'hunt') {
        b.left -= dt;
        if (b.left <= 0 || S.over || S.cleared) {
          b.phase = 'bye';
          b.byeT = BYE;
          b.save = false;
          emit('buddyBye', { tank: t });
        }
        return;
      }
      if (b.phase === 'bye') {
        b.byeT -= dt;
        if (b.byeT <= 0) {
          t.alive = false;
          S.buddy = null;
          emit('buddyOut', { tank: t });
        }
      }
    }

    // ---------------- one tick

    function step(dt) {
      S.t += dt;
      if (S.freezeT > 0) S.freezeT = Math.max(0, S.freezeT - dt);
      if (S.shovelT > 0) {
        S.shovelT -= dt;
        if (S.shovelT <= 0) { S.shovelT = 0; setRing(BRICK); emit('shovelEnd', {}); }
      }
      if (S.cheerCool > 0) S.cheerCool = Math.max(0, S.cheerCool - dt);
      if (S.cheerT > 0) S.cheerT = Math.max(0, S.cheerT - dt);
      if (S.over) S.overT += dt;

      for (const P of S.players) {
        if (!P.tank && !P.out && P.respawnT > 0) {
          P.respawnT -= dt;
          if (P.respawnT <= 0 && !S.over) spawnPlayer(P);
        }
      }
      spawnFoes(dt);
      updateBuddy(dt);

      const frozen = S.freezeT > 0;
      for (const t of S.tanks) {
        if (!t.alive) continue;
        if (t.shield > 0) t.shield = Math.max(0, t.shield - dt);
        if (t.cool > 0) t.cool -= dt;
        const isPlayer = t.variant === 'player' && !t.buddy;
        if (t.team === 'enemy') {
          if (frozen) { t.moving = false; watchStill(t, dt, true); continue; }
          if (TT.brain) TT.brain.think(S, t, dt);
          driveAI(t, dt);
          if (t.wantFire) fire(t);
        } else if (t.buddy) {
          if (S.buddy && S.buddy.phase === 'hunt') {
            if (TT.brain) TT.brain.think(S, t, dt);
            driveAI(t, dt);
            if (t.wantFire) fire(t);
          } else if (S.buddy && S.buddy.phase !== 'enter') t.moving = false;
        } else if (isPlayer) {
          if (S.over) { t.moving = false; continue; }
          if (S.auto[t.player]) {
            if (TT.brain) TT.brain.think(S, t, dt);
            driveAI(t, dt);
            if (t.wantFire) fire(t);
          } else {
            const inp = S.input[t.player];
            drivePlayer(t, inp, dt);
            // a tap always fires; holding the button keeps firing a little slower
            if (inp.press) { fire(t); t.fireHeld = 0; }
            else if (inp.fire) { t.fireHeld += dt; if (t.fireHeld >= 0.3 && fire(t)) t.fireHeld = 0; }
            else t.fireHeld = 0;
            inp.press = false;
          }
        }
        watchStill(t, dt, frozen);
      }
      S.tanks = S.tanks.filter((t) => t.alive);

      moveShells(dt);

      if (S.power) {
        S.power.t -= dt;
        if (S.power.t <= 0) { emit('powerGone', { power: S.power }); S.power = null; }
        else {
          for (const P of S.players) {
            const t = P.tank;
            if (!t || !t.alive) continue;
            if (Math.abs(t.x - S.power.x) < 1.6 && Math.abs(t.y - S.power.y) < 1.6) { takePower(P, t); break; }
          }
        }
      }

      if (!S.over && !S.cleared && !S.queue.length && !S.sparkles.length && !S.tanks.some((t) => t.team === 'enemy')) {
        S.clearT += dt;
        if (S.clearT >= 1.4) { S.cleared = true; emit('clear', {}); }
      }
    }

    // For the check: how long has each computer tank gone without moving, and has one paced in a tiny box for 20 s?
    function watchStill(t, dt, frozen) {
      const human = t.variant === 'player' && !t.buddy && !S.auto[t.player];
      if (human || t.aiming || (t.team === 'enemy' && frozen) || (t.buddy && S.buddy && S.buddy.phase !== 'hunt')) {
        t.stillT = 0;
        t.win = { t0: S.t, x0: t.x, x1: t.x, y0: t.y, y1: t.y };
        return;
      }
      const moved = Math.abs(t.x - t.lastX) + Math.abs(t.y - t.lastY) > 1e-4;
      t.lastX = t.x;
      t.lastY = t.y;
      t.stillT = moved ? 0 : t.stillT + dt;
      S.stats.maxStill = Math.max(S.stats.maxStill, t.stillT);
      if (t.stillT > 8 && !t.flagged) {
        t.flagged = true;
        S.stats.stuck.push({ who: t.team === 'enemy' ? `${t.kind} ${t.variant}` : t.kind, x: t.x, y: t.y, t: +S.t.toFixed(1) });
      }
      const w = t.win;
      w.x0 = Math.min(w.x0, t.x); w.x1 = Math.max(w.x1, t.x); w.y0 = Math.min(w.y0, t.y); w.y1 = Math.max(w.y1, t.y);
      if (S.t - w.t0 >= 20) {
        const enemiesAround = t.team === 'enemy' || S.tanks.some((o) => o.alive && o.team === 'enemy');
        if (enemiesAround && w.x1 - w.x0 < 1.5 && w.y1 - w.y0 < 1.5 && !t.paced) {
          t.paced = true;
          S.stats.pacing.push({ who: t.team === 'enemy' ? `${t.kind} ${t.variant}` : t.kind, x: t.x, y: t.y, t: +S.t.toFixed(1) });
        }
        t.win = { t0: S.t, x0: t.x, x1: t.x, y0: t.y, y1: t.y };
      }
    }

    // ---------------- test and cheat hooks

    function give(type, i = 0) {
      const P = S.players[i];
      if (!P || !P.tank) return false;
      S.power = { type, x: P.tank.x, y: P.tank.y, t: 18 };
      takePower(P, P.tank);
      return true;
    }

    // Drop a power-up on the field (as if a flashing tank had been hit).
    function spawnPower(type, x, y) {
      if (x === undefined) { dropPower(S.players[0].tank); if (type && S.power) S.power.type = type; }
      else { S.power = { type, x, y, t: 18 }; emit('powerUp', { power: S.power }); }
      return S.power;
    }

    function winNow() {
      for (const o of S.tanks) if (o.team === 'enemy' && o.alive) killFoe(o, null, 'bomb');
      S.killed += S.queue.length + S.sparkles.length;
      S.queue = [];
      S.sparkles = [];
    }

    Object.assign(S, {
      step, callBuddy, give, spawnPower, winNow, fire, cell, endGame, poofPlayer,
      remaining: () => S.queue.length,
      foesLeft: () => S.queue.length + S.sparkles.length + S.tanks.filter((t) => t.team === 'enemy').length,
      visit: VISIT,
    });
    return S;
  }

  TT.sim = {
    N, EMPTY, BRICK, STEEL, WATER, TREES, ICE, BASE, BLOCKS_TANK, BLOCKS_SHELL, DIRS, TILES,
    BASE_X, BASE_Y, RING, RING_TILES, PLAYER_SPAWN, FOE_SPAWN, BASE_GOALS, LEVELS, FOES, FOE_ORDER, TREATS,
    VISIT, HELLO, BYE, POWERS, rng, parseMap, fixedParts, fixedTile, setTile, create,
  };
})();
