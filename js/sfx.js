/* Tank TT: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const TT = (window.TT = window.TT || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);

  // The stage-start jingle: a bouncy little march of our own (C major, square lead over a triangle bass).
  const JINGLE = [
    [523, 0.0, 0.12], [659, 0.13, 0.12], [784, 0.26, 0.12], [1047, 0.39, 0.22],
    [880, 0.65, 0.12], [988, 0.78, 0.12], [1047, 0.91, 0.12], [1175, 1.04, 0.12], [1319, 1.17, 0.4],
  ];
  const JBASS = [[131, 0.0], [196, 0.26], [175, 0.65], [196, 0.91], [262, 1.17]];

  TT.sfx = {
    jingle() {
      for (const [f, at, dur] of JINGLE) tone({ type: 'square', f, at, dur, vol: 0.07, lp: 3200 });
      for (const [f, at] of JBASS) tone({ type: 'triangle', f, at, dur: 0.24, vol: 0.22 });
      hiss({ filter: 'highpass', f: 6000, at: 1.17, dur: 0.3, vol: 0.06 });
    },
    // tank treads: a low chug, called a few times a second while a player tank rolls
    tread(pitch = 1) {
      tone({ type: 'sawtooth', f: 62 * pitch, to: 48 * pitch, dur: 0.09, vol: 0.06, lp: 320 });
    },
    idle() { tone({ type: 'sawtooth', f: 44, dur: 0.08, vol: 0.025, lp: 220 }); },
    shot(kind) {
      if (kind === 'ball') { // a basketball: a rubbery "pung"
        tone({ type: 'triangle', f: 220, to: 520, dur: 0.12, vol: 0.2 });
        tone({ type: 'sine', f: 140, to: 90, dur: 0.1, vol: 0.18 });
      } else if (kind === 'peace') { // a twinkly star
        tone({ type: 'triangle', f: 1320, to: 1760, dur: 0.1, vol: 0.12 });
        tone({ type: 'sine', f: 2093, at: 0.05, dur: 0.12, vol: 0.08 });
        hiss({ filter: 'highpass', f: 5000, dur: 0.08, vol: 0.05 });
      } else if (kind === 'zap') {
        tone({ type: 'square', f: 900, to: 300, dur: 0.12, vol: 0.05, lp: 2400 });
      } else { // goo
        tone({ type: 'sine', f: 320, to: 160, dur: 0.12, vol: 0.14 });
        hiss({ filter: 'lowpass', f: 900, dur: 0.06, vol: 0.06 });
      }
    },
    brick() {
      hiss({ filter: 'lowpass', f: 1600, to: 260, dur: 0.18, vol: 0.22 });
      tone({ type: 'triangle', f: 180, to: 90, dur: 0.1, vol: 0.12 });
    },
    steel() {
      tone({ type: 'square', f: 1480, dur: 0.06, vol: 0.05, lp: 4000 });
      tone({ type: 'triangle', f: 2200, at: 0.02, dur: 0.14, vol: 0.07 });
    },
    steelBreak() {
      tone({ type: 'square', f: 900, to: 200, dur: 0.25, vol: 0.06, lp: 2500 });
      hiss({ filter: 'highpass', f: 2500, dur: 0.25, vol: 0.12 });
    },
    edge() { tone({ type: 'triangle', f: 600, to: 400, dur: 0.06, vol: 0.06 }); },
    pop() {
      tone({ type: 'sine', f: 700, to: 1400, dur: 0.07, vol: 0.12 });
      hiss({ f: 3000, dur: 0.05, vol: 0.06 });
    },
    // an enemy tank goes poof into stars
    poof() {
      tone({ type: 'square', f: 300, to: 900, dur: 0.12, vol: 0.06, lp: 2400 });
      hiss({ filter: 'lowpass', f: 2600, to: 400, dur: 0.3, vol: 0.2 });
      [1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.08 + i * 0.05, dur: 0.12, vol: 0.08 }));
    },
    clang() { // an armored tank's armor takes a hit
      tone({ type: 'square', f: 520, dur: 0.07, vol: 0.06, lp: 2400 });
      tone({ type: 'triangle', f: 780, at: 0.03, dur: 0.12, vol: 0.08 });
    },
    // your tank gets bonked: a cartoon boing and a slide down
    bonk() {
      tone({ f: 260, to: 90, dur: 0.14, vol: 0.32 });
      tone({ type: 'square', f: 660, to: 220, at: 0.06, dur: 0.4, vol: 0.06, lp: 1800 });
      hiss({ filter: 'lowpass', f: 2000, to: 300, dur: 0.35, vol: 0.18 });
    },
    boing() { tone({ type: 'sine', f: 300, to: 700, dur: 0.18, vol: 0.14 }); },
    powerAppear() { [784, 988, 1175, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.1, vol: 0.09 })); },
    powerGet() { S.powerup(); },
    life() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.1, vol: 0.06, lp: 3500 })); },
    freeze() { for (let i = 0; i < 4; i++) tone({ type: 'square', f: i % 2 ? 1200 : 1600, at: i * 0.18, dur: 0.04, vol: 0.05, lp: 4000 }); },
    bomb() {
      hiss({ filter: 'lowpass', f: 3000, to: 120, dur: 0.8, vol: 0.45 });
      tone({ f: 120, to: 40, dur: 0.6, vol: 0.4 });
      for (let i = 0; i < 5; i++) tone({ type: 'triangle', f: 900 + i * 220, at: 0.2 + i * 0.06, dur: 0.1, vol: 0.07 });
    },
    shovel() { for (let i = 0; i < 3; i++) { tone({ type: 'square', f: 300, at: i * 0.12, dur: 0.05, vol: 0.06, lp: 2000 }); tone({ type: 'triangle', f: 1200, at: i * 0.12 + 0.02, dur: 0.06, vol: 0.05 }); } },
    shield() { hiss({ f: 1200, to: 5000, dur: 0.4, vol: 0.1, q: 3 }); tone({ type: 'sine', f: 600, to: 1200, dur: 0.35, vol: 0.08 }); },
    // the cookie jar falls over: a sad wah-wah-waaah
    sad() {
      [392, 370, 349].forEach((f, i) => tone({ type: 'sawtooth', f, to: f * 0.97, at: i * 0.35, dur: 0.32, vol: 0.06, lp: 1200 }));
      tone({ type: 'sawtooth', f: 330, to: 260, at: 1.05, dur: 0.9, vol: 0.07, lp: 1100 });
    },
    fanfare() {
      const notes = [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.78], [784, 0.9], [1047, 1.05]];
      for (const [f, at] of notes) tone({ type: 'square', f, at, dur: at >= 1.05 ? 0.55 : 0.13, vol: 0.07, lp: 3600 });
      for (const [f, at] of [[131, 0], [196, 0.36], [262, 0.6], [196, 0.9], [262, 1.05]]) tone({ type: 'triangle', f, at, dur: 0.3, vol: 0.22 });
    },
    hello() { // the companion's horn: beep-beep!
      tone({ type: 'square', f: 660, dur: 0.1, vol: 0.06, lp: 2400 });
      tone({ type: 'square', f: 880, at: 0.14, dur: 0.14, vol: 0.06, lp: 2400 });
    },
    treat() { S.coin(3); tone({ type: 'triangle', f: 1568, at: 0.12, dur: 0.2, vol: 0.1 }); },
    save() {
      tone({ type: 'triangle', f: 880, dur: 0.1, vol: 0.12 });
      tone({ type: 'triangle', f: 1320, at: 0.08, dur: 0.25, vol: 0.12 });
      hiss({ f: 2500, to: 6000, dur: 0.3, vol: 0.08 });
    },
    cheer() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.14, vol: 0.1 }));
      hiss({ f: 1800, dur: 0.9, vol: 0.06, attack: 0.1, q: 0.5 });
    },
    nope() { tone({ type: 'square', f: 200, dur: 0.08, vol: 0.05, lp: 1200 }); tone({ type: 'square', f: 160, at: 0.09, dur: 0.1, vol: 0.05, lp: 1200 }); },
    tick() { tone({ type: 'square', f: 1000, dur: 0.03, vol: 0.04 }); },
    tally() { tone({ type: 'square', f: 1200, dur: 0.03, vol: 0.04, lp: 4000 }); },
    click() { S.click(); },
    swish() { S.swish(); },
    paint() { tone({ type: 'triangle', f: 500 + Math.random() * 200, dur: 0.04, vol: 0.06 }); },
  };
})();
