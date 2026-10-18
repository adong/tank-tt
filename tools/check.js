#!/usr/bin/env node
/* Runs the stage check in Node (no browser, no npm):  node tools/check.js [--soak] [--easy] [--1p] [--seeds=N]
   Loads the game's rules (stages, sim, brain, check) into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/stages.js', 'js/sim.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const TT = ctx.TT;
const args = process.argv.slice(2);
let bad = 0;

const maps = TT.check.maps();
for (const m of maps) {
  if (m.probs.length) bad++;
  console.log(`${m.probs.length ? 'FAIL' : 'ok  '} stage ${String(m.stage).padStart(2)} ${m.name}${m.probs.length ? ': ' + m.probs.join('; ') : ''}`);
}
console.log(`map check: ${maps.length} stages, ${bad} with problems`);

const sab = TT.check.sabotage();
console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken setups caught`);
for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.probs.length ? ' (' + s.probs[0] + ')' : ''}`);
if (sab.some((s) => !s.caught)) bad++;

if (args.includes('--soak')) {
  const level = args.includes('--easy') ? 'easy' : 'normal';
  const players = args.includes('--1p') ? ['teddy'] : ['teddy', 'tommy'];
  const seeds = Number((args.find((a) => a.startsWith('--seeds=')) || '').split('=')[1]) || 1;
  const t0 = Date.now();
  let notCleared = 0, stuck = 0, pacing = 0, worstStill = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const res = TT.check.soak({ level, players, seed: seed * 101, buddyEvery: players.length === 1 ? 14 : 0 });
    for (const r of res) {
      if (!r.cleared) notCleared++;
      stuck += r.stuck.length;
      pacing += r.pacing.length;
      worstStill = Math.max(worstStill, r.maxStill);
      if (seeds === 1 || !r.cleared || r.stuck.length) {
        console.log(`  seed ${seed} stage ${String(r.stage).padStart(2)} ${r.name.padEnd(20)} ${r.cleared ? 'cleared' : 'NOT CLEARED'} ${String(r.time).padStart(4)} s` +
          `  still max ${r.maxStill} s  stuck ${r.stuck.length}  pacing ${r.pacing.length}  jar hits ${r.baseHits}  kills ${r.kills}` +
          (players.length === 1 ? `  treats ${r.treats} buddy kills ${r.buddyKills} saves ${r.saves}` : '') +
          (r.stuck.length ? '  ' + r.stuck.map((s) => `${s.who}@${s.x.toFixed(1)},${s.y.toFixed(1)} t${s.t}`).join(' ') : '') +
          (r.pacing.length ? '  pacing: ' + r.pacing.map((s) => `${s.who}@${s.x.toFixed(1)},${s.y.toFixed(1)} t${s.t}`).join(' ') : ''));
      }
    }
  }
  console.log(`soak ${players.length}P ${level}: ${seeds * TT.STAGES.length} runs, ${notCleared} not cleared, ${stuck} stuck tanks, ${pacing} pacing, longest still ${worstStill} s (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (notCleared || stuck) bad++;
}
process.exitCode = bad ? 1 : 0;
