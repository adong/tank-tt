/* Tank TT: the stage check. Runs in the browser console (game.check(), game.soak()) and in Node (tools/check.js).
   - map(): every map has 13 x 13 known characters and 20 foes; every zombie gate can reach the cookie jar and
     both players' starts can reach every gate (through bricks, which can be shot, but never through steel or water).
   - soak(): the autopilot plays each stage headlessly (players can't run out of tanks, the jar can't break) and
     records whether the stage clears, how long any computer tank stood still, and any tank that paced inside a
     one-tile box for 20 s. A tank standing still for more than 8 s counts as stuck.
   - sabotage(): deliberately broken maps and a deliberately lazy driver, to prove the checks can fail. */
(function () {
  'use strict';
  const TT = window.TT;
  const M = TT.sim;

  function mapProblems(stage) {
    const probs = [];
    const { grid, problems } = M.parseMap(stage.map);
    probs.push(...problems);
    const foes = stage.foes || [];
    if (foes.length !== 4 || foes.reduce((a, b) => a + b, 0) !== 20) probs.push(`foes should be 4 numbers adding up to 20 (has ${JSON.stringify(foes)})`);
    const S = { grid, gridVer: 1 };
    const NN = TT.brain.NN;
    const toBase = TT.brain.baseField(Object.assign(S, { t: 0 }));
    const gates = ['middle', 'right', 'left'];
    M.FOE_SPAWN.forEach(([x, y], i) => {
      if (!isFinite(toBase[y * NN + x])) probs.push(`the ${gates[i]} zombie gate can't reach the cookie jar`);
    });
    for (const k in M.PLAYER_SPAWN) {
      const [px, py] = M.PLAYER_SPAWN[k];
      M.FOE_SPAWN.forEach(([x, y], i) => {
        const d = TT.brain.field(S, [y * NN + x], true); // players shouldn't have to break their own jar's wall
        if (!isFinite(d[py * NN + px])) probs.push(`${k === 'teddy' ? "Teddy's" : "Tommy's"} start can't reach the ${gates[i]} gate`);
      });
    }
    return probs;
  }

  function maps(stages = TT.STAGES) {
    return stages.map((st, i) => ({ stage: i + 1, name: st.name, probs: mapProblems(st) }));
  }

  // One stage, played by the autopilot. opts: { players, level, seed, maxTime, buddyEvery, test }
  function soakStage(stage, stageNo, opts = {}) {
    const players = opts.players || ['teddy', 'tommy'];
    const S = M.create({
      stage, stageNo, players, level: opts.level || 'normal', seed: opts.seed || stageNo * 7919,
      auto: opts.noAuto ? [false, false] : [true, true],
      test: Object.assign({ infinite: true, immortalBase: true }, opts.test || {}),
    });
    const dt = 1 / 60, maxTime = opts.maxTime || 420;
    let nextBuddy = opts.buddyEvery || 0;
    while (S.t < maxTime && !S.cleared && !S.over) {
      if (opts.buddyEvery && S.t >= nextBuddy) { S.callBuddy(); nextBuddy += opts.buddyEvery; }
      S.step(dt);
      S.events.length = 0;
    }
    const kills = S.players.reduce((n, P) => n + P.kills.basic + P.kills.fast + P.kills.power + P.kills.armor, 0);
    return {
      stage: stageNo, name: stage.name, cleared: S.cleared, time: Math.round(S.t), left: S.foesLeft(),
      maxStill: +S.stats.maxStill.toFixed(1), stuck: S.stats.stuck, pacing: S.stats.pacing,
      baseHits: S.stats.baseHits, kills, shots: S.stats.shots, saves: S.stats.saves, treats: S.stats.treats, buddyKills: S.stats.buddyKills,
    };
  }

  function soak(opts = {}) {
    const stages = opts.stages || TT.STAGES;
    return stages.map((st, i) => soakStage(st, i + 1, opts));
  }

  // Broken on purpose: each of these must be caught.
  function sabotage() {
    const base = TT.STAGES[0].map.slice();
    const edit = (rows, fn) => { const g = rows.map((r) => r.split('')); fn(g); return g.map((r) => r.join('')); };
    const broken = [
      { name: 'middle gate boxed in steel', map: edit(base, (g) => { g[1][5] = g[1][6] = g[1][7] = '@'; g[0][5] = g[0][7] = '@'; }) },
      { name: 'water moat around the jar', map: edit(base, (g) => { for (let x = 3; x <= 9; x++) g[10][x] = '~'; g[11][3] = g[11][4] = g[11][8] = g[11][9] = '~'; g[12][3] = g[12][9] = '~'; }) },
      { name: "Teddy's start walled in steel", map: edit(base, (g) => { g[11][4] = g[12][3] = '@'; }) },
      { name: 'a row that is too short', map: edit(base, (g) => { g[4].pop(); }) },
      { name: 'a mystery character', map: edit(base, (g) => { g[4][4] = 'Q'; }) },
    ];
    const out = broken.map((b) => {
      const probs = mapProblems({ name: b.name, map: b.map, foes: [20, 0, 0, 0] });
      return { name: b.name, caught: probs.length > 0, probs };
    });
    const lazy = soakStage(TT.STAGES[6], 7, { test: { lazy: true }, noAuto: true, maxTime: 120 });
    out.push({ name: 'lazy zombie drivers who never turn when blocked', caught: lazy.stuck.length > 0, probs: lazy.stuck.slice(0, 3).map((s) => `${s.who} stuck at ${s.x},${s.y} (${s.t} s)`) });
    const idle = soakStage(TT.STAGES[0], 1, { noAuto: true, maxTime: 120 });
    out.push({ name: 'nobody drives the player tanks', caught: !idle.cleared, probs: idle.cleared ? [] : [`stage not cleared after ${idle.time} s, ${idle.left} foes left`] });
    return out;
  }

  TT.check = { mapProblems, maps, soakStage, soak, sabotage };
})();
