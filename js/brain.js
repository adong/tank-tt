/* Tank TT: the computer drivers. No Three.js here either.
   - Zombie and robot tanks roam like the arcade original (keep going, now and then a new heading, mostly downhill),
     and every few seconds pick a mood: roam, head for the cookie jar, or chase a player. They shoot bricks in
     their way and fire at whatever is straight ahead.
   - Allies (the companion brother, and the autopilot used by the title-screen demo and the check) hunt the nearest
     enemy, line up and fire, collect power-ups, and never shoot their own jar's brick ring.
   Paths come from distance fields over the 25 x 25 "nodes" a tank's top-left corner can sit on. Bricks are
   passable at a cost (you can shoot through them); steel, water and the jar are not. */
(function () {
  'use strict';
  const TT = window.TT;
  const M = TT.sim;
  const N = M.N, NN = N - 1;
  const { BRICK, STEEL, WATER, BASE, DIRS } = M;
  const BRICK_COST = 4;
  const EPS = 1e-6;

  const RING_CELL = new Uint8Array(N * N);
  for (const [x, y] of M.RING) RING_CELL[y * N + x] = 1;
  const RING_NODE = new Uint8Array(NN * NN); // nodes whose 2x2 block touches the jar's ring
  for (let y = 0; y < NN; y++) for (let x = 0; x < NN; x++) {
    for (let k = 0; k < 4; k++) if (RING_CELL[(y + (k >> 1)) * N + x + (k & 1)]) RING_NODE[y * NN + x] = 1;
  }

  // ---------------------------------------------------------------- paths

  function costs(S, ally) {
    const key = ally ? '_costA' : '_costE';
    const cache = S[key];
    if (cache && cache.ver === S.gridVer) return cache.c;
    const c = new Float32Array(NN * NN);
    for (let y = 0; y < NN; y++) {
      for (let x = 0; x < NN; x++) {
        let v = 1, bricks = 0;
        for (let k = 0; k < 4; k++) {
          const g = S.grid[(y + (k >> 1)) * N + x + (k & 1)];
          if (g === STEEL || g === WATER || g === BASE) { v = Infinity; break; }
          if (g === BRICK) bricks++;
        }
        if (v !== Infinity && bricks) v += BRICK_COST;
        if (ally && RING_NODE[y * NN + x]) v = Infinity; // allies keep off the jar's own wall
        c[y * NN + x] = v;
      }
    }
    S[key] = { ver: S.gridVer, c };
    return c;
  }

  // Dijkstra outwards from the seed nodes: dist[n] = cheapest way from n to a seed.
  function field(S, seeds, ally) {
    const c = costs(S, ally);
    const dist = new Float32Array(NN * NN).fill(Infinity);
    const hn = [], hd = [];
    const push = (n, d) => {
      let i = hn.length;
      hn.push(n); hd.push(d);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hd[p] <= d) break;
        hn[i] = hn[p]; hd[i] = hd[p]; i = p;
      }
      hn[i] = n; hd[i] = d;
    };
    const pop = () => {
      const n = hn[0], d = hd[0];
      const ln = hn.pop(), ld = hd.pop();
      if (hn.length) {
        let i = 0;
        for (;;) {
          let m = i;
          const l = 2 * i + 1, r = l + 1;
          if (l < hn.length && hd[l] < (m === i ? ld : hd[m])) m = l;
          if (r < hn.length && hd[r] < (m === i ? ld : hd[m])) m = r;
          if (m === i) break;
          hn[i] = hn[m]; hd[i] = hd[m]; i = m;
        }
        hn[i] = ln; hd[i] = ld;
      }
      return [n, d];
    };
    for (const n of seeds) if (n >= 0 && dist[n] !== 0) { dist[n] = 0; push(n, 0); }
    while (hn.length) {
      const [n, d] = pop();
      if (d > dist[n]) continue;
      const step = isFinite(c[n]) ? c[n] : 1;
      const x = n % NN, y = (n / NN) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= NN || ny >= NN) continue;
        const m = ny * NN + nx;
        if (!isFinite(c[m])) continue;
        const nd = d + step;
        if (nd < dist[m]) { dist[m] = nd; push(m, nd); }
      }
    }
    return dist;
  }

  const clampN = (v) => Math.max(0, Math.min(NN - 1, Math.round(v)));
  const nodeOf = (t) => clampN(t.y) * NN + clampN(t.x);
  const atNode = (t) => Math.abs(t.x - Math.round(t.x)) < 1e-4 && Math.abs(t.y - Math.round(t.y)) < 1e-4;

  const BASE_SEEDS = M.BASE_GOALS.map(([x, y]) => y * NN + x);
  function baseField(S) {
    if (!S._fBase || S._fBase.ver !== S.gridVer) S._fBase = { ver: S.gridVer, d: field(S, BASE_SEEDS, false) };
    return S._fBase.d;
  }

  // Cached for a moment: targets move, but not that fast.
  function timed(S, key, ally, seedsFn) {
    const f = S[key];
    if (f && S.t - f.t < 0.3 && f.ver === S.gridVer) return f.d;
    const seeds = seedsFn();
    const d = seeds.length ? field(S, seeds, ally) : null;
    S[key] = { t: S.t, ver: S.gridVer, d };
    return d;
  }
  const playerField = (S, i) => timed(S, '_fP' + i, false, () => {
    const P = S.players[i];
    return P && P.tank && P.tank.alive ? [nodeOf(P.tank)] : [];
  });
  const foeField = (S) => timed(S, '_fFoe', true, () => S.tanks.filter((o) => o.alive && o.team === 'enemy').map(nodeOf));
  const followField = (S) => timed(S, '_fFollow', true, () => {
    const P = S.players[0];
    return P && P.tank && P.tank.alive ? [nodeOf(P.tank)] : [];
  });
  function powerField(S) {
    const p = S.power;
    if (!p) return null;
    if (!S._fPow || S._fPow.p !== p || S._fPow.ver !== S.gridVer) S._fPow = { p, ver: S.gridVer, d: field(S, [p.y * NN + p.x], true) };
    return S._fPow.d;
  }
  function homeField(S, i) {
    const key = '_fHome' + i;
    if (!S[key] || S[key].ver !== S.gridVer) {
      const [x, y] = S.players[i].spawn;
      S[key] = { ver: S.gridVer, d: field(S, [y * NN + x], true) };
    }
    return S[key].d;
  }

  // Which way is downhill from t's node in this field? null if nowhere is better (or it's already at a seed).
  function downhill(S, t, dist, ally) {
    const c = costs(S, ally);
    const x = clampN(t.x), y = clampN(t.y);
    const here = dist[y * NN + x];
    if (here === 0) return null;
    let best = null, bestV = Infinity;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= NN || ny >= NN) continue;
      const m = ny * NN + nx;
      const v = dist[m] + c[m] + (d === t.dir ? -0.01 : S.rand() * 0.02);
      if (v < bestV) { bestV = v; best = d; }
    }
    return isFinite(bestV) ? best : null;
  }

  // Nodes a player can drive to from the starts. allowBricks: counting bricks they'd have to shoot through.
  function reachable(S, allowBricks) {
    const key = allowBricks ? '_reachB' : '_reachO';
    if (S[key] && S[key].ver === S.gridVer) return S[key].r;
    const c = costs(S, false);
    const r = new Uint8Array(NN * NN);
    const q = [];
    for (const k in M.PLAYER_SPAWN) {
      const [x, y] = M.PLAYER_SPAWN[k];
      const n = y * NN + x;
      if (!r[n]) { r[n] = 1; q.push(n); }
    }
    while (q.length) {
      const n = q.pop();
      const x = n % NN, y = (n / NN) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= NN || ny >= NN) continue;
        const m = ny * NN + nx;
        if (r[m] || !isFinite(c[m]) || (!allowBricks && c[m] > 1)) continue;
        r[m] = 1;
        q.push(m);
      }
    }
    S[key] = { ver: S.gridVer, r };
    return r;
  }

  // ---------------------------------------------------------------- what's ahead

  const cellAt = (S, x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : S.grid[y * N + x]);

  // The two cells right in front of t's nose.
  function frontCells(t, k = 0) {
    const d = t.dir, out = [];
    if (d === 0 || d === 2) {
      const r = d === 0 ? Math.floor(t.y + EPS) - 1 - k : Math.ceil(t.y + 2 - EPS) + k;
      for (let x = Math.floor(t.x + EPS); x <= Math.ceil(t.x + 2 - EPS) - 1; x++) out.push([x, r]);
    } else {
      const c = d === 3 ? Math.floor(t.x + EPS) - 1 - k : Math.ceil(t.x + 2 - EPS) + k;
      for (let y = Math.floor(t.y + EPS); y <= Math.ceil(t.y + 2 - EPS) - 1; y++) out.push([c, y]);
    }
    return out;
  }

  function brickAhead(S, t, ally) {
    let brick = false;
    for (const [x, y] of frontCells(t)) {
      const v = cellAt(S, x, y);
      if (v === BRICK) {
        if (ally && RING_CELL[y * N + x]) return false; // never break our own jar's wall
        brick = true;
      }
    }
    return brick;
  }

  function openAhead(S, t, dir) {
    const c = costs(S, t.team === 'ally');
    const nx = clampN(t.x) + DIRS[dir][0], ny = clampN(t.y) + DIRS[dir][1];
    return nx >= 0 && ny >= 0 && nx < NN && ny < NN && isFinite(c[ny * NN + nx]);
  }

  // A random way that isn't shut by steel, water or the edge: mostly down (toward the jar), rarely back up.
  function openDir(S, t, avoidCurrent) {
    const weights = t.team === 'enemy' ? [1, 2, 3, 2] : [2, 2, 2, 2];
    let total = 0;
    const opts = [];
    for (let d = 0; d < 4; d++) {
      if (avoidCurrent && d === t.dir) continue;
      if (!openAhead(S, t, d)) continue;
      const w = weights[d] * (d === (t.dir + 2) % 4 ? 0.6 : 1);
      opts.push([d, w]);
      total += w;
    }
    if (!opts.length) return avoidCurrent ? (t.dir + 2) % 4 : t.dir;
    let r = S.rand() * total;
    for (const [d, w] of opts) { if ((r -= w) <= 0) return d; }
    return opts[opts.length - 1][0];
  }

  // Can a shell from t, heading `dir`, get `dist` cells (centre to centre) without hitting steel?
  // Up to maxBricks rows of bricks are fine. Allies also won't shoot through the jar or its ring.
  function clearShot(S, t, dir, dist, maxBricks, ally) {
    const steps = Math.max(0, Math.floor(dist - 1.5));
    let bricks = 0;
    for (let k = 0; k < steps; k++) {
      let rowBrick = false;
      for (const [x, y] of frontCells(t, k)) {
        const v = cellAt(S, x, y);
        if (v === -1) return true;
        if (v === STEEL) return false;
        if (v === BASE) return !ally && false;
        if (v === BRICK) {
          if (ally && RING_CELL[y * N + x]) return false;
          rowBrick = true;
        }
      }
      if (rowBrick && ++bricks > maxBricks) return false;
    }
    return true;
  }

  // The nearest target straight ahead, behind or to the side, in line with t's barrel: { dir, dist, tank }.
  function lineUp(S, t, targets, maxBricks, ally) {
    const cx = t.x + 1, cy = t.y + 1;
    let best = null;
    for (const [ox, oy, tank] of targets) {
      let dir = -1, dist = 0;
      if (Math.abs(ox - cx) < 1.25) { dir = oy < cy ? 0 : 2; dist = Math.abs(oy - cy); }
      else if (Math.abs(oy - cy) < 1.25) { dir = ox < cx ? 3 : 1; dist = Math.abs(ox - cx); }
      if (dir < 0 || dist > 20) continue;
      const probe = { x: t.x, y: t.y, dir };
      if (dir !== t.dir && (dir & 1) !== (t.dir & 1)) { // turning snaps to a whole cell: test from there
        if (t.dir & 1) probe.x = Math.round(t.x); else probe.y = Math.round(t.y);
      }
      if (!clearShot(S, probe, dir, dist, maxBricks, ally)) continue;
      if (!best || dist < best.dist) best = { dir, dist, tank };
    }
    return best;
  }

  // ---------------------------------------------------------------- zombie and robot tanks

  const between = (S, [a, b]) => a + S.rand() * (b - a);

  function enemyMind(S) {
    return { mode: 'roam', modeT: 1 + S.rand() * 3, fireT: between(S, S.L.fireGap), lookT: 0, blockedT: 0, detourT: 0, target: 0 };
  }

  function pickMode(S, t, a) {
    a.modeT = 4 + S.rand() * 5;
    const r = S.rand();
    const base = (S.t < 15 ? 0.2 : 0.45) * S.L.baseMood;
    const hunt = t.variant === 'fast' ? 0.35 : 0.15;
    const alive = S.players.filter((P) => P.tank && P.tank.alive);
    if (r < base && S.baseAlive) a.mode = 'base';
    else if (r < base + hunt && alive.length) { a.mode = 'hunt'; a.target = alive[Math.floor(S.rand() * alive.length)].i; }
    else a.mode = 'roam';
  }

  const atBaseGoal = (t) => M.BASE_GOALS.find(([x, y]) => Math.abs(t.x - x) < 1e-4 && Math.abs(t.y - y) < 1e-4);

  function enemyThink(S, t, dt) {
    const a = t.ai || (t.ai = enemyMind(S));
    t.wantFire = false;
    t.go = true;
    a.modeT -= dt;
    if (a.modeT <= 0) pickMode(S, t, a);
    if (a.detourT > 0) a.detourT -= dt;
    a.fireT -= dt;
    if (a.fireT <= 0) { t.wantFire = true; a.fireT = between(S, S.L.fireGap); }
    a.lookT -= dt;
    if (a.lookT <= 0) {
      a.lookT = 0.3;
      const targets = S.players.filter((P) => P.tank && P.tank.alive).map((P) => [P.tank.x + 1, P.tank.y + 1, P.tank]);
      if (S.baseAlive) targets.push([M.BASE_X + 1, M.BASE_Y + 1, null]);
      const tg = lineUp(S, t, targets, 2, false);
      if (tg) {
        if (tg.dir === t.dir) { if (S.rand() < S.L.aim) t.wantFire = true; }
        else if (S.rand() < S.L.aim * 0.4) { t.want = tg.dir; a.detourT = 0.5; }
      }
    }
    const goal = a.mode === 'base' && S.baseAlive && atBaseGoal(t);
    if (goal) { t.want = goal[2]; t.go = false; t.wantFire = true; return; }
    if (t.blocked) {
      a.blockedT += dt;
      if (brickAhead(S, t, false)) t.wantFire = true;
      else if (!S.test.lazy && a.blockedT > 0.4) { t.want = openDir(S, t, true); a.blockedT = 0; a.detourT = 1.2; }
    } else a.blockedT = 0;
    if (t.want === null || t.want === undefined) t.want = t.dir;
    if (!t.moving && !t.blocked && atNode(t) && a.detourT <= 0) enemyNode(S, t);
  }

  function enemyNode(S, t) {
    const a = t.ai || (t.ai = enemyMind(S));
    if (a.detourT > 0 || S.test.lazy) return;
    if (a.mode === 'base' || a.mode === 'hunt') {
      const dist = a.mode === 'base' ? baseField(S) : playerField(S, a.target);
      if (dist) {
        if (a.mode === 'base' && atBaseGoal(t)) return;
        const d = downhill(S, t, dist, false);
        if (d !== null) { t.want = d; return; }
      }
    }
    if (S.rand() < 0.15 || !openAhead(S, t, t.dir)) t.want = openDir(S, t, false);
  }

  // ---------------------------------------------------------------- allies: the companion and the autopilot

  function allyGoal(S, t) {
    const foes = S.tanks.some((o) => o.alive && o.team === 'enemy');
    if (!t.buddy && S.power) {
      const d = powerField(S);
      if (d && isFinite(d[nodeOf(t)])) return d;
    }
    if (foes) return foeField(S);
    if (t.buddy) return followField(S);
    return homeField(S, t.player);
  }

  function allyThink(S, t, dt) {
    const a = t.ai || (t.ai = { blockedT: 0, detourT: 0 });
    t.wantFire = false;
    t.go = true;
    if (a.detourT > 0) a.detourT -= dt;
    const foes = S.tanks.filter((o) => o.alive && o.team === 'enemy').map((o) => [o.x + 1, o.y + 1, o]);
    const tg = foes.length && lineUp(S, t, foes, 3, true);
    t.aiming = !!tg;
    if (tg) { t.want = tg.dir; t.go = false; t.wantFire = true; return; }
    if (t.blocked) {
      a.blockedT += dt;
      if (brickAhead(S, t, true)) t.wantFire = true;
      else if (a.blockedT > 0.5) { t.want = openDir(S, t, true); a.blockedT = 0; a.detourT = 1.0; }
    } else a.blockedT = 0;
    if (atNode(t) && !t.moving && !t.blocked && a.detourT <= 0) allyNode(S, t);
    if (t.want === null || t.want === undefined) t.want = t.dir;
  }

  function allyNode(S, t) {
    const a = t.ai || (t.ai = { blockedT: 0, detourT: 0 });
    if (a.detourT > 0) return;
    const dist = allyGoal(S, t);
    if (!dist) return;
    const d = downhill(S, t, dist, true);
    if (d === null) { t.go = false; return; } // there (or nowhere better to be)
    t.want = d;
  }

  function think(S, t, dt) {
    if (t.team === 'enemy') enemyThink(S, t, dt);
    else allyThink(S, t, dt);
  }

  function node(S, t) {
    if (t.team === 'enemy') enemyNode(S, t);
    else allyNode(S, t);
  }

  TT.brain = { think, node, costs, field, baseField, downhill, reachable, nodeOf, atNode, lineUp, clearShot, NN, RING_NODE };
})();
