/* Tank TT: the game. Sets up Three.js, runs the rules (js/sim.js) at a fixed 60 ticks a second, turns the rules'
   events into tanks, shells, poofs, sounds, toasts and the HUD, and handles menus, keys and touch.
   Test hooks live on window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const T = THREE;
  const TT = window.TT;
  const G = Kit.gfx;
  const A = TT.art;
  const M = TT.sim;
  const SFX = TT.sfx;
  const $ = (id) => document.getElementById(id);
  const DT = 1 / 60;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  const EL = 1.0; // camera elevation: a top-down view tipped a little toward you

  // ---------------------------------------------------------------- storage

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const settings = Object.assign({ level: 'normal', stage: 1 }, store.get('tankTT.settings', {}));
  const best = Object.assign({ easy: 0, normal: 0, hi: 0 }, store.get('tankTT.best', {}));
  const saveSettings = () => store.set('tankTT.settings', settings);

  // ---------------------------------------------------------------- renderer, scene, camera

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  scene.background = new T.Color('#6f737d');
  const camera = new T.PerspectiveCamera(30, 1, 0.5, 200);
  scene.add(new T.HemisphereLight('#ffffff', '#5b6070', 0.8));
  const sun = new T.DirectionalLight('#fff3e0', 1.0);
  sun.position.set(-4, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  A.initTextures();
  const arena = A.makeArena(scene);
  const base = A.makeBase(scene);
  const fx = A.makeFx(scene);

  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (touch) document.body.classList.add('touch');

  // pictures for the menus and the HUD
  const faces = Kit.portraits(['teddy', 'tommy', 'zombie', 'bolt'].map((id) => Kit.roster.get(id)), { size: 152 });
  function tankIcon(hull, stripe) {
    const [c, g] = G.makeCanvas(64, 64);
    A.miniTankCanvas(g, 32, 36, 0.62, hull, stripe);
    return c.toDataURL();
  }
  const icons = {
    teddy: tankIcon('#3f86e8', '#e53935'), tommy: tankIcon('#7fdcbd', '#f6eedc'), foe: tankIcon('#e9edf3', '#ff5a6e'),
    basic: tankIcon('#8db05a', '#5b7834'), fast: tankIcon('#ffd400', '#5b7834'), power: tankIcon('#ff9636', '#626877'), armor: tankIcon('#ff6fa8', '#ffffff'),
  };
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const sig = (kind, which) => Kit.roster.signature(Kit.roster.get(kind), which);

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'loading', modeT: 0, time: 0, sim: null, demo: false, acc: 0,
    players: ['teddy'], level: settings.level, stageNo: clamp(settings.stage | 0, 1, TT.STAGES.length),
    custom: null, carry: null, frozen: false, keepAwake: false, prev: null,
    toasts: [], anims: [], banner: null, cel: null, overShown: false, gridVer: -1, ringFlash: null,
    treadT: 0, sfxAt: {},
  };
  let rect = { x: 0, y: 0, size: 100 };

  // ---------------------------------------------------------------- tank views

  const views = new Map();
  const pool = {};
  const shellPool = {};
  const shellViews = new Map();
  const sparkleViews = new Map();
  let powerView = null, powerRef = null;
  const markers = [0, 1].map((i) => {
    const s = A.spriteOf(A.burstTexture(i ? '2P' : '1P', i ? '#7fdcbd' : '#8cc2ff'), 0.7, { depthTest: false });
    s.renderOrder = 6;
    s.visible = false;
    scene.add(s);
    return s;
  });

  function takeView(t) {
    const key = `${t.kind}-${t.variant}${t.buddy ? '-buddy' : ''}`;
    let v = (pool[key] || []).pop();
    if (!v) {
      v = A.buildTank(t.kind, t.variant);
      A.addDriver(v, t.kind === 'robot' ? 'bolt' : t.kind, t.team === 'enemy' ? 0.3 : 0.34);
      A.addShield(v);
      if (t.buddy) {
        A.addHalo(v, '#ffd400');
        const tag = G.nameTag(NAMES[t.kind], Kit.roster.get(t.kind).tag || '#ffb02e');
        tag.position.y = 1.45;
        tag.scale.multiplyScalar(0.8);
        tag.material.depthTest = false;
        tag.renderOrder = 6;
        v.root.add(tag);
      }
      v.key = key;
    }
    v.yaw = -t.dir * Math.PI / 2;
    v.body.rotation.y = v.yaw;
    v.body.position.y = 0;
    v.look = Math.PI;
    v.phase0 = Math.random() * 10;
    v.phase = 0;
    v.poseT = 0;
    v.pose = null;
    v.celeb = false;
    v.person.root.scale.setScalar(v.ps);
    v.person.root.position.set(0, -1.08 * v.ps, 0);
    v.person.head.scale.setScalar(1.45);
    v.holder.rotation.y = Math.PI;
    v.shield.visible = false;
    v.root.visible = true;
    v.root.rotation.set(0, 0, 0);
    v.root.scale.setScalar(1);
    scene.add(v.root);
    return v;
  }

  function dropView(v) {
    scene.remove(v.root);
    (pool[v.key] || (pool[v.key] = [])).push(v);
  }

  function clearViews() {
    for (const v of views.values()) dropView(v);
    views.clear();
    for (const [, v] of shellViews) { scene.remove(v); (shellPool[v.userData.kind] || (shellPool[v.userData.kind] = [])).push(v); }
    shellViews.clear();
    for (const s of sparkleViews.values()) scene.remove(s);
    sparkleViews.clear();
    if (powerView) scene.remove(powerView);
    powerView = powerRef = null;
    if (st.cel) { for (const c of st.cel.tanks) dropView(c.v); st.cel = null; }
    for (const a of st.anims) if (a.cleanup) a.cleanup();
    st.anims = [];
    fx.clear();
    markers.forEach((m) => { m.visible = false; });
  }

  function colorTank(v, t, S) {
    let col = v.look.hull, tcol = v.look.turret, em = 0;
    if (t.team === 'enemy') {
      if (t.variant === 'armor' && Math.floor(st.time * 8) % 2) col = tcol = A.ARMOR_COLORS[clamp(t.hp, 1, 4)];
      if (t.flash && Math.floor(st.time * 7) % 2) col = tcol = '#ff3b3b';
      if (S.freezeT > 0) em = 0x2d5d8c;
    }
    if (v._col !== col) { v.hullMat.color.set(col); v._col = col; }
    if (v._tcol !== tcol) { v.turretMat.color.set(tcol); v._tcol = tcol; }
    if (v._em !== em) { v.hullMat.emissive.setHex(em); v.turretMat.emissive.setHex(em); v._em = em; }
  }

  // The driver in the hatch: looks around (mostly up at you), and does his signature move when there's a reason.
  function drive(v, t, S, dt) {
    const p = v.person;
    v.phase += dt * 6;
    let mode = 'idle';
    const b = S.buddy;
    if (t.buddy && b) {
      if (b.phase === 'hello' || b.helloT > 0) mode = sig(t.kind, 'hello');
      else if (b.phase === 'bye') mode = sig(t.kind, 'goodbye');
    }
    if (S.cheerT > 0 && t.variant === 'player') mode = sig(t.kind, 'hello');
    if (v.poseT > 0) { v.poseT -= dt; mode = v.pose; }
    Kit.people.pose(p, v.phase, mode, 1 - Math.exp(-14 * dt));
    settle(p);
    p.head.rotation.x = mode === 'idle' ? 0.6 : 0.35; // tip the face up toward the camera
    let aim = Math.PI + Math.sin(st.time * 0.8 + v.phase0) * 0.75;
    if (t.moving && (t.dir === 1 || t.dir === 3)) aim = Math.PI + (t.dir === 1 ? 0.95 : -0.95) + Math.sin(st.time * 1.3 + v.phase0) * 0.25;
    if (mode !== 'idle') aim = Math.PI;
    v.look += (aim - v.look) * Math.min(1, dt * 4);
    v.holder.rotation.y = v.look;
    const up = mode === 'idle' ? 0 : 0.07;
    p.root.position.y += (-1.08 * v.ps + up - p.root.position.y) * Math.min(1, dt * 8);
  }

  // Kit poses stride for running buddies: plant the feet for standing ones.
  function settle(p) {
    p.legL.rotation.x = 0;
    p.legR.rotation.x = 0;
    p.hips.position.y = p.hipY;
  }

  function syncViews(dt) {
    const S = st.sim;
    if (!S) return;
    if (st.mode === 'celebrate' || st.mode === 'tally') return;
    const seen = new Set();
    for (const t of S.tanks) {
      if (!t.alive) continue;
      let v = views.get(t.id);
      if (!v) { v = takeView(t); views.set(t.id, v); }
      seen.add(t.id);
      v.root.position.set(A.wx(t.x + 1), 0, A.wx(t.y + 1));
      const want = -t.dir * Math.PI / 2;
      const d = Math.atan2(Math.sin(want - v.yaw), Math.cos(want - v.yaw));
      v.yaw += d * Math.min(1, dt * 18);
      v.body.rotation.y = v.yaw;
      v.treadTop.offset.y = -t.tread * 1.6;
      v.treadSide.offset.x = t.tread * 1.6;
      v.body.position.y = t.moving ? Math.abs(Math.sin(st.time * 22 + t.id)) * 0.014 : 0;
      v.shield.visible = t.shield > 0 && (t.shield > 1.2 || Math.floor(st.time * 10) % 2 === 0);
      if (v.shield.visible) { v.cage.rotation.y += dt * 1.6; v.cage.rotation.x += dt * 0.7; }
      colorTank(v, t, S);
      drive(v, t, S, dt);
    }
    for (const [id, v] of views) if (!seen.has(id)) { dropView(v); views.delete(id); }

    // shells
    const live = new Set();
    for (const s of S.shells) {
      let v = shellViews.get(s.id);
      if (!v) {
        v = (shellPool[s.kind] || []).pop() || A.shellView(s.kind);
        v.userData.kind = s.kind;
        scene.add(v);
        shellViews.set(s.id, v);
      }
      v.position.set(A.wx(s.x), 0.42, A.wx(s.y));
      if (s.kind === 'ball') v.userData.spin.material.rotation -= dt * 14;
      if (s.kind === 'peace') {
        v.userData.spin.material.rotation = Math.sin(st.time * 12) * 0.3;
        if (Math.random() < dt * 30) fx.add({ map: G.emojiTexture('⭐'), x: v.position.x, y: 0.42, z: v.position.z, life: 0.35, size: 0.2, grow: -0.4, spin: 4, fade: 0.6 });
      }
      live.add(s.id);
    }
    for (const [id, v] of shellViews) {
      if (live.has(id)) continue;
      scene.remove(v);
      (shellPool[v.userData.kind] || (shellPool[v.userData.kind] = [])).push(v);
      shellViews.delete(id);
    }

    // the power-up
    if (S.power !== powerRef) {
      if (powerView) scene.remove(powerView);
      powerView = S.power ? A.powerView(S.power.type) : null;
      if (powerView) scene.add(powerView);
      powerRef = S.power;
    }
    if (powerView) {
      powerView.position.set(A.wx(S.power.x + 1), 0.75 + Math.sin(st.time * 4) * 0.08, A.wx(S.power.y + 1));
      const blink = S.power.t < 4 ? Math.floor(st.time * 8) % 2 === 0 : true;
      powerView.visible = blink;
      powerView.userData.badge.material.rotation = Math.sin(st.time * 3) * 0.12;
    }

    // spawn sparkles at the zombie gates
    for (const sp of S.sparkles) {
      let s = sparkleViews.get(sp);
      if (!s) { s = A.spriteOf(A.tex.sparkle, 1, { blending: T.AdditiveBlending }); scene.add(s); sparkleViews.set(sp, s); }
      const k = 0.55 + Math.abs(Math.sin(st.time * 9)) * 0.75;
      s.scale.set(k * 1.3, k * 1.3, 1);
      s.material.rotation = st.time * 3;
      s.position.set(A.wx(sp.x + 1), 0.5, A.wx(sp.y + 1));
    }
    for (const [sp, s] of sparkleViews) if (!S.sparkles.includes(sp)) { scene.remove(s); sparkleViews.delete(sp); }

    // a little 1P / 2P marker above a player hiding under the trees
    S.players.forEach((P, i) => {
      const t = P.tank, m = markers[st.players.length === 1 ? 0 : i];
      let under = false;
      if (t && t.alive) {
        for (let k = 0; k < 4 && !under; k++) if (S.cell(Math.floor(t.x + 0.5) + (k & 1), Math.floor(t.y + 0.5) + (k >> 1)) === M.TREES) under = true;
      }
      m.visible = under && !st.demo;
      if (under) m.position.set(A.wx(t.x + 1), 1.5 + Math.sin(st.time * 5) * 0.08, A.wx(t.y + 1));
    });
    if (st.players.length === 1) markers[1].visible = false;
  }

  // ---------------------------------------------------------------- sounds and effects from the rules' events

  function play(name, ...args) {
    if (st.demo) return;
    const now = st.time;
    if (st.sfxAt[name] !== undefined && now - st.sfxAt[name] < 0.05) return;
    st.sfxAt[name] = now;
    SFX[name](...args);
  }
  const cw = (c) => A.wx(c);
  const tankAt = (t) => [A.wx(t.x + 1), A.wx(t.y + 1)];
  const SHIELD_WORDS = ['BOING!', 'BOINK!', 'PING!'];

  function onEvent(e, S) {
    switch (e.type) {
      case 'shot':
        if (e.tank.team === 'ally') play('shot', e.tank.shellKind);
        else if (Math.random() < 0.6) play('shot', e.tank.shellKind);
        break;
      case 'brick':
        fx.chunks(cw(e.x + 0.5), cw(e.y + 0.5), '#d0602e', 3);
        play('brick');
        break;
      case 'steel':
        fx.sparkle(cw(e.x), cw(e.y), 0.45, 0.6, 0.25);
        play('steel');
        break;
      case 'steelBreak':
        fx.chunks(cw(e.x + 0.5), cw(e.y + 0.5), '#c9ced8', 4);
        play('steelBreak');
        break;
      case 'edge':
        fx.puff(cw(e.x), cw(e.y), 2, '#ffffff', 0.4, 0.6);
        play('edge');
        break;
      case 'pop':
        fx.word(cw(e.x), cw(e.y), 'POP!', '#ffffff', 0.7, 0.8);
        play('pop');
        break;
      case 'foeHit': {
        const [x, z] = tankAt(e.tank);
        fx.word(x, z, 'CLANG!', '#c8f0ff', 0.75, 1.0);
        fx.sparkle(x, z, 0.5, 0.9, 0.3);
        play('clang');
        break;
      }
      case 'foeDown': {
        const [x, z] = tankAt(e.tank);
        fx.puff(x, z, 7, '#ffffff', 0.4, 1.6);
        fx.stars(x, z, e.how === 'bomb' ? 10 : 8);
        fx.word(x, z, e.how === 'bomb' ? 'POOF!' : G.pick(['POW!', 'POOF!', 'BAM!']), '#ffd400', 1.0, 1.0);
        if (e.points) fx.points(x, z - 0.2, e.points);
        play('poof');
        break;
      }
      case 'allyDown': {
        const [x, z] = tankAt(e.tank);
        fx.puff(x, z, 9, '#ffffff', 0.5, 1.8);
        fx.stars(x, z, 10);
        fx.word(x, z, 'BONK!', '#ff8fb8', 1.15, 1.1);
        play('bonk');
        if (S.two) toast(`${NAMES[e.tank.kind]} GOT BONKED! BACK IN A SEC…`, 'oops', 1.6);
        break;
      }
      case 'shieldBlock':
      case 'buddyBonk': {
        const [x, z] = tankAt(e.tank);
        fx.word(x, z, G.pick(SHIELD_WORDS), '#8ff0ff', 0.7, 1.0);
        play('boing');
        break;
      }
      case 'buddySave': {
        const who = NAMES[S.buddyKind];
        toast(e.what === 'base' ? `${who} SAVED THE COOKIES!` : `${who} SAVED YOU!`, 'save', 2.2);
        const v = e.buddy && views.get(e.buddy.id);
        if (v) { v.poseT = 1.4; v.pose = sig(S.buddyKind, 'hello'); }
        if (e.what === 'base') { fx.sparkle(0, cw(M.BASE_Y + 1), 0.7, 2.2, 0.7); fx.stars(0, cw(M.BASE_Y + 1), 10); }
        else { const [x, z] = tankAt(e.tank); fx.sparkle(x, z, 0.6, 1.8, 0.6); fx.word(x, z, 'SAVED!', '#18d4ff', 1.0, 1.1); }
        play('save');
        break;
      }
      case 'powerUp':
        play('powerAppear');
        break;
      case 'powerGot': {
        const [x, z] = tankAt(e.tank);
        fx.sparkle(x, z, 0.7, 1.6, 0.5);
        fx.points(x, z - 0.2, 500);
        const msg = {
          star: ['', '⭐ FASTER SHOTS!', '⭐⭐ TWO SHOTS AT ONCE!', '⭐⭐⭐ STEEL BUSTER!'][e.star] || '⭐ SUPER SHOTS!',
          helmet: '🪖 SHIELD ON!', shovel: '🧱 STEEL AROUND THE COOKIES!', clock: '⏰ FREEZE!', bomb: '💣 KABOOM! ALL POOF!', tank: '+1 TANK!',
        }[e.power.type];
        toast(msg, 'good', 1.8);
        play('powerGet');
        if (e.power.type === 'bomb') { play('bomb'); flash('#ffffff', 0.35); }
        else if (e.power.type === 'clock') play('freeze');
        else if (e.power.type === 'shovel') play('shovel');
        else if (e.power.type === 'helmet') play('shield');
        else if (e.power.type === 'tank') play('life');
        bumpCard(e.player);
        break;
      }
      case 'extraLife':
        if (e.why === 'score') { toast(`+1 TANK FOR ${NAMES[S.players[e.player].kind]}!`, 'good', 1.8); play('life'); bumpCard(e.player); }
        break;
      case 'playerIn': {
        const [x, z] = tankAt(e.tank);
        fx.sparkle(x, z, 0.5, 1.6, 0.5);
        break;
      }
      case 'baseLost':
        base.lose();
        for (let i = 0; i < 6; i++) fx.emoji('🍪', 0, cw(M.BASE_Y + 1), { vx: (Math.random() - 0.5) * 3, vy: 4 + Math.random() * 2, vz: -2 - Math.random() * 3, g: 6, life: 1.6, size: 0.45, spin: 5 });
        fx.puff(0, cw(M.BASE_Y + 1), 10, '#ffffff', 0.5, 2);
        fx.word(0, cw(M.BASE_Y + 1), 'OH NO!', '#ff8fb8', 1.3, 1.4);
        play('sad');
        break;
      case 'over':
        st.overAt = st.time + (e.why === 'base' ? 2.6 : 1.8);
        break;
      case 'clear':
        st.clearAt = st.time + 0.4;
        break;
      case 'buddyIn':
        play('hello');
        toast(`HERE COMES ${NAMES[S.buddyKind]}!`, 'good', 1.5);
        break;
      case 'buddyHello':
        if (e.again) play('hello');
        break;
      case 'treat':
        throwTreat(e, S);
        break;
      case 'buddyOut': {
        const [x, z] = tankAt(e.tank);
        fx.sparkle(x, z, 0.6, 2, 0.6);
        fx.stars(x, z, 8);
        fx.puff(x, z, 5);
        break;
      }
      case 'cheer':
        toast('BROTHER POWER! 🛡️', 'save', 2);
        play('cheer');
        play('shield');
        for (const P of S.players) if (P.tank) { const [x, z] = tankAt(P.tank); fx.stars(x, z, 8); }
        break;
      case 'cheerNo':
        play('nope');
        nudge($('budBtn'));
        break;
      case 'playerOut':
        if (S.two) toast(`${NAMES[S.players[e.player].kind]} IS OUT OF TANKS!`, 'oops', 2);
        break;
      default:
        break;
    }
  }

  // The companion's treat: it arcs from his hatch to yours, then the toast.
  function throwTreat(e, S) {
    const from = views.get(e.from.id);
    const to = e.to && e.to.alive ? e.to : null;
    const fx0 = from ? from.root.position.x : 0, fz0 = from ? from.root.position.z : cw(M.BASE_Y);
    const sprite = A.spriteOf(G.emojiTexture(e.emoji), 0.6, { depthTest: false });
    sprite.renderOrder = 7;
    scene.add(sprite);
    play('swish');
    st.anims.push({
      t: 0, dur: 0.9,
      tick(a, dt) {
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        const tx = to ? A.wx(to.x + 1) : fx0, tz = to ? A.wx(to.y + 1) : fz0;
        sprite.position.set(lerp(fx0, tx, k), 0.9 + Math.sin(k * Math.PI) * 1.6, lerp(fz0, tz, k));
        sprite.material.rotation = k * 6;
        if (k >= 1) {
          fx.sparkle(tx, tz, 0.9, 1.4, 0.5);
          fx.stars(tx, tz, 6, 0.9, 2);
          toast(`${e.emoji} ${e.name} FROM ${NAMES[e.who]}!`, 'good', 2.2);
          play('treat');
          return true;
        }
        return false;
      },
      cleanup() { scene.remove(sprite); },
    });
  }

  // ---------------------------------------------------------------- toasts, banner, flash

  function toast(text, cls = '', dur = 1.8) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    st.toasts.unshift({ el, born: st.time, dur });
    while (st.toasts.length > 4) st.toasts.pop().el.remove();
  }

  function updateToasts() {
    const y0 = rect.y + rect.size * 0.56;
    for (let i = st.toasts.length - 1; i >= 0; i--) {
      const o = st.toasts[i];
      const age = st.time - o.born;
      if (age > o.dur) { o.el.remove(); st.toasts.splice(i, 1); continue; }
      const kin = Math.min(1, age / 0.18), kout = clamp((o.dur - age) / 0.3, 0, 1);
      const sc = kin < 1 ? 1.6 - 0.6 * smooth(kin) : 1;
      o.el.style.opacity = String(Math.min(kin * 1.5, kout));
      o.el.style.top = `${y0 + i * 46 - (1 - kout) * 20}px`;
      o.el.style.transform = `translateX(-50%) scale(${sc})`;
    }
  }

  function banner(html, dur = 1.6) {
    const el = $('banner');
    el.innerHTML = html;
    el.classList.remove('hidden');
    st.banner = { born: st.time, dur };
  }

  function updateBanner() {
    const el = $('banner'), b = st.banner;
    if (!b) return;
    const age = st.time - b.born;
    if (age > b.dur) { el.classList.add('hidden'); st.banner = null; return; }
    const kin = Math.min(1, age / 0.3);
    el.style.top = `${rect.y + rect.size * (st.mode === 'celebrate' ? 0.06 : 0.32)}px`;
    el.style.opacity = String(Math.min(kin * 2, clamp((b.dur - age) / 0.3, 0, 1)));
    el.style.transform = `scale(${kin < 1 ? 2 - smooth(kin) : 1})`;
  }

  const flashEl = document.createElement('div');
  Object.assign(flashEl.style, { position: 'fixed', inset: '0', pointerEvents: 'none', opacity: '0' });
  document.body.appendChild(flashEl);
  let flashT = 0, flashDur = 1;
  function flash(color, dur) { flashEl.style.background = color; flashT = dur; flashDur = dur; }

  function nudge(el) {
    el.classList.remove('no');
    void el.offsetWidth;
    el.classList.add('no');
  }

  // a quick yellow flash on a player's card (timed by the game clock, so it also works in a background tab)
  const cardBump = [-9, -9];
  function bumpCard(i) { cardBump[i] = st.time; }

  // ---------------------------------------------------------------- layout and camera

  const cam = { dist: 30, ox: 0, oy: 0, focus: 0, fitZ: 0.4 };

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = h > w * 1.08;
    document.body.classList.toggle('portrait', portrait);
    const two = st.players.length === 2;
    const building = st.mode === 'build';
    const L = $('leftCol'), R = $('rightCol'), bud = $('budBtn');
    const BL = $('buildLeft'), BR = $('buildRight');
    const place = (el, x, y, wd) => { el.style.left = `${x}px`; el.style.top = `${y}px`; if (wd) el.style.width = `${wd}px`; };
    const pads = [$('pad0'), $('pad1')], fires = [$('fire0'), $('fire1')];
    pads.forEach((p) => p.classList.remove('show'));
    fires.forEach((f) => f.classList.remove('show'));
    const playing = ['play', 'intro', 'pause'].includes(st.mode);
    if (!portrait) {
      const side = clamp(w * 0.18, 124, 236);
      const size = Math.max(160, Math.min(h - 20, w - 2 * side - 30));
      rect = { x: (w - size) / 2, y: (h - size) / 2, size };
      const lx = rect.x - side - 10, rx = rect.x + size + 10;
      place(L, lx, rect.y + 4, side);
      place(R, rx, rect.y + 4, side);
      place(BL, lx, rect.y + 4, side);
      place(BR, rx, rect.y + 4, side);
      const pad = h <= 520 ? 128 : 156, fireS = h <= 520 ? 84 : 100, budS = h <= 520 ? 84 : 104, m = 14;
      const bottom = h - m;
      if (touch && playing) {
        pads[0].classList.add('show');
        place(pads[0], lx + (side - pad) / 2, bottom - pad);
        fires[0].classList.add('show');
        if (two) {
          pads[1].classList.add('show');
          place(pads[1], rx + (side - pad) / 2, bottom - pad);
          fires[1].classList.add('show');
          place(fires[0], lx + (side - fireS) / 2, bottom - pad - fireS - 12);
          place(fires[1], rx + (side - fireS) / 2, bottom - pad - fireS - 12);
          place(bud, rx + (side - budS) / 2, bottom - pad - fireS - budS - 26);
        } else {
          place(fires[0], rx + (side - fireS) / 2, bottom - fireS);
          place(bud, rx + (side - budS) / 2, bottom - fireS - budS - 18);
        }
      } else {
        place(bud, rx + (side - budS) / 2, bottom - budS - 8);
      }
    } else {
      const top = 64, bot = touch ? 200 : 120;
      const size = Math.max(160, Math.min(w - 12, h - top - bot - 12));
      rect = { x: (w - size) / 2, y: top + 6, size };
      place(L, 8, 8, w / 2 - 12);
      place(R, w / 2 + 4, 8, w / 2 - 12);
      R.style.alignItems = 'flex-end';
      const by = rect.y + size + 12;
      place(BL, 8, by, w - 16);
      place(BR, 8, by + 70, w - 16);
      const budS = 86, pad = 156, fireS = 100;
      if (touch && playing) {
        pads[0].classList.add('show');
        place(pads[0], 12, h - pad - 14);
        fires[0].classList.add('show');
        if (two) {
          pads[1].classList.add('show');
          place(pads[1], w - pad - 12, h - pad - 14);
          fires[1].classList.add('show');
          place(fires[0], 12 + pad + 8, h - fireS - 20);
          place(fires[1], w - pad - 12 - fireS - 8, h - fireS - 20);
          place(bud, (w - budS) / 2, by);
        } else {
          place(fires[0], w - fireS - 18, h - fireS - 24);
          place(bud, (w - budS) / 2, h - budS - 30);
        }
      } else place(bud, w - budS - 16, h - budS - 16);
    }
    if (!portrait) R.style.alignItems = '';
    fitCamera();
  }

  const corners = [];
  for (const x of [-7.1, 7.1]) for (const z of [-7.1, 7.1]) for (const y of [0, 0.6]) corners.push(new T.Vector3(x, y, z));
  const tmpV = new T.Vector3();

  function placeCamera(target, el, dist) {
    camera.position.set(target.x, target.y + Math.sin(el) * dist, target.z + Math.cos(el) * dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  // Fit the arena (with its grey frame) into the square `rect`, then shift the picture so it sits right there.
  function fitCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const target = new T.Vector3(0, 0, cam.fitZ);
    let d = 30;
    let box;
    for (let it = 0; it < 6; it++) {
      placeCamera(target, EL, d);
      box = project();
      const k = Math.max(((box.x1 - box.x0) / 2) * w / rect.size, ((box.y1 - box.y0) / 2) * h / rect.size);
      d *= k;
    }
    placeCamera(target, EL, d);
    box = project();
    const cx = ((box.x0 + box.x1) / 2 + 1) / 2 * w, cy = (1 - (box.y0 + box.y1) / 2) / 2 * h;
    cam.dist = d;
    cam.ox = cx - (rect.x + rect.size / 2);
    cam.oy = cy - (rect.y + rect.size / 2);
    camera.setViewOffset(w, h, cam.ox, cam.oy, w, h);
    camera.updateProjectionMatrix();
    cam.lastOx = cam.ox;
    cam.lastOy = cam.oy;
  }

  function project() {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    camera.updateProjectionMatrix();
    for (const c of corners) {
      tmpV.copy(c).project(camera);
      b.x0 = Math.min(b.x0, tmpV.x); b.x1 = Math.max(b.x1, tmpV.x);
      b.y0 = Math.min(b.y0, tmpV.y); b.y1 = Math.max(b.y1, tmpV.y);
    }
    return b;
  }

  const fitTarget = new T.Vector3(), celTarget = new T.Vector3(0, 0.9, 4.9), camTarget = new T.Vector3();
  function updateCamera(dt) {
    const want = st.mode === 'celebrate' || (st.mode === 'tally' && st.cel) ? 1 : 0;
    cam.focus += (want - cam.focus) * Math.min(1, dt * 2.2);
    const f = smooth(clamp(cam.focus, 0, 1));
    fitTarget.set(0, 0, cam.fitZ);
    camTarget.copy(fitTarget).lerp(celTarget, f);
    let shake = 0;
    if (st.shakeT > 0) { st.shakeT -= dt; shake = st.shakeT * 0.25; }
    placeCamera(camTarget, lerp(EL, 0.55, f), lerp(cam.dist, cam.dist * 0.36, f));
    // while focused on the brothers, centre them in the arena's square instead of using the arena-fit offset
    const w = window.innerWidth, h = window.innerHeight;
    const ox = lerp(cam.ox, w / 2 - (rect.x + rect.size / 2), f), oy = lerp(cam.oy, h / 2 - (rect.y + rect.size / 2), f);
    if (ox !== cam.lastOx || oy !== cam.lastOy) {
      cam.lastOx = ox;
      cam.lastOy = oy;
      camera.setViewOffset(w, h, ox, oy, w, h);
      camera.updateProjectionMatrix();
    }
    if (st.peek) placeCamera(new T.Vector3(st.peek.x, 0.3, st.peek.z), st.peek.el, st.peek.dist);
    if (shake) camera.position.x += (Math.random() - 0.5) * shake;
  }

  // ---------------------------------------------------------------- input

  const keyDir = [[], []];
  const keyFire = [false, false];
  const pressFire = [false, false];
  const touchDir = [null, null];
  const touchFire = [false, false];
  const P1_DIRS = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
  const P2_DIRS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

  function readInput() {
    const S = st.sim;
    if (!S || st.demo) return;
    for (let i = 0; i < S.players.length; i++) {
      const inp = S.input[i];
      const kd = keyDir[i].length ? keyDir[i][keyDir[i].length - 1] : null;
      inp.dir = touchDir[i] !== null ? touchDir[i] : kd;
      inp.fire = keyFire[i] || touchFire[i];
      if (pressFire[i]) { inp.press = true; pressFire[i] = false; }
    }
  }

  function clearInput() {
    keyDir[0].length = keyDir[1].length = 0;
    keyFire[0] = keyFire[1] = pressFire[0] = pressFire[1] = touchFire[0] = touchFire[1] = false;
    touchDir[0] = touchDir[1] = null;
  }

  const firstGesture = () => { Kit.sound.init(); if (st.mode === 'title') Kit.sound.music('title'); };

  window.addEventListener('keydown', (e) => {
    firstGesture();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    if (st.mode === 'build') { editor.key(e); return; }
    const one = st.players.length === 1;
    if (st.mode === 'play' || st.mode === 'intro') {
      let pi = -1, d = -1;
      if (c in P1_DIRS) { pi = 0; d = P1_DIRS[c]; }
      else if (c in P2_DIRS) { pi = one ? 0 : 1; d = P2_DIRS[c]; }
      if (pi >= 0) {
        e.preventDefault();
        const arr = keyDir[pi];
        const k = arr.indexOf(d);
        if (k >= 0) arr.splice(k, 1);
        arr.push(d);
        return;
      }
      if (c === 'KeyF' || c === 'Space') { e.preventDefault(); if (!e.repeat) pressFire[0] = true; keyFire[0] = true; return; }
      if (c === 'KeyL' || c === 'Numpad0' || c === 'Slash') { e.preventDefault(); const i = one ? 0 : 1; if (!e.repeat) pressFire[i] = true; keyFire[i] = true; return; }
      if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { e.preventDefault(); callBuddy(); return; }
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') { e.preventDefault(); resume(); }
      else if (c === 'KeyR') restartStage();
      else if (c === 'KeyQ') toMenu();
      return;
    }
    if (st.mode === 'title') {
      if (c === 'Digit1' || c === 'Numpad1') startGame(['teddy']);
      else if (c === 'Digit2' || c === 'Numpad2') startGame(['tommy']);
      else if (c === 'Digit3' || c === 'Numpad3') startGame(['teddy', 'tommy']);
      else if (c === 'KeyB') openBuild();
      else if (c === 'KeyE') setLevel(st.level === 'easy' ? 'normal' : 'easy');
      else if (c === 'ArrowLeft' || c === 'KeyA') pickStage(-1);
      else if (c === 'ArrowRight' || c === 'KeyD') pickStage(1);
      else if (c === 'Enter' || c === 'Space') { e.preventDefault(); startGame(settings.lastPlayers || ['teddy']); }
      return;
    }
    if (st.mode === 'tally') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); nextStage(); }
      else if (c === 'Escape') toMenu();
      return;
    }
    if (st.mode === 'over') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); retry(); }
      else if (c === 'Escape') toMenu();
    }
  });

  window.addEventListener('keyup', (e) => {
    const c = e.code;
    const one = st.players.length === 1;
    let pi = -1, d = -1;
    if (c in P1_DIRS) { pi = 0; d = P1_DIRS[c]; }
    else if (c in P2_DIRS) { pi = one ? 0 : 1; d = P2_DIRS[c]; }
    if (pi >= 0) { const k = keyDir[pi].indexOf(d); if (k >= 0) keyDir[pi].splice(k, 1); return; }
    if (c === 'KeyF' || c === 'Space') keyFire[0] = false;
    if (c === 'KeyL' || c === 'Numpad0' || c === 'Slash') keyFire[one ? 0 : 1] = false;
  });
  window.addEventListener('blur', clearInput);

  // touch: a d-pad and a fire button per player
  function bindPad(el, i) {
    let id = null;
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      let d = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > dead) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      touchDir[i] = d;
      el.dataset.dir = d === null ? '' : String(d);
    };
    el.addEventListener('pointerdown', (e) => { firstGesture(); id = e.pointerId; el.setPointerCapture(id); set(e); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const up = (e) => { if (e.pointerId !== id) return; id = null; touchDir[i] = null; el.dataset.dir = ''; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function bindFire(el, i) {
    el.addEventListener('pointerdown', (e) => { firstGesture(); el.setPointerCapture(e.pointerId); touchFire[i] = true; pressFire[i] = true; el.classList.add('down'); e.preventDefault(); });
    const up = () => { touchFire[i] = false; el.classList.remove('down'); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  bindPad($('pad0'), 0);
  bindPad($('pad1'), 1);
  bindFire($('fire0'), 0);
  bindFire($('fire1'), 1);
  $('budBtn').addEventListener('pointerdown', (e) => {
    firstGesture();
    e.preventDefault();
    const el = $('budBtn');
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 120);
    callBuddy();
  });

  function callBuddy() {
    if (st.mode !== 'play' || !st.sim) return;
    st.sim.callBuddy();
  }

  function toggleMute() {
    Kit.sound.init();
    const m = Kit.sound.toggleMute();
    document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; });
  }
  document.querySelectorAll('.muteBtn').forEach((b) => {
    b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    b.addEventListener('click', toggleMute);
  });
  $('pauseBtn').addEventListener('click', () => (st.mode === 'pause' ? resume() : pause()));

  // ---------------------------------------------------------------- screens and flow

  const SCREENS = ['title', 'pause', 'tally', 'over'];
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  }

  function setMode(m) {
    st.mode = m;
    st.modeT = 0;
    const hud = ['play', 'intro', 'pause', 'celebrate'].includes(m) || (m === 'over' && !st.demo);
    $('hud').classList.toggle('hidden', !hud);
    $('budBtn').classList.toggle('hidden', m === 'celebrate');
    $('budBar').style.visibility = m === 'celebrate' ? 'hidden' : '';
    $('build').classList.toggle('hidden', m !== 'build');
    layout();
  }

  function makeSim(stageNo, opts = {}) {
    const stage = st.custom ? { name: st.custom.name, map: st.custom.map, foes: [12, 4, 2, 2] } : TT.STAGES[stageNo - 1];
    return M.create({
      stage, stageNo: st.custom ? 6 : stageNo, players: opts.players || st.players, level: opts.level || st.level,
      seed: (Date.now() & 0xffffff) + stageNo, carry: opts.carry || null,
      auto: opts.demo ? [true, true] : [false, false], test: opts.demo ? { infinite: true } : {},
    });
  }

  function loadStage(stageNo, opts = {}) {
    clearViews();
    clearInput();
    st.stageNo = stageNo;
    st.demo = !!opts.demo;
    st.sim = makeSim(stageNo, opts);
    st.acc = 0;
    st.overAt = st.clearAt = 0;
    st.ringFlash = null;
    arena.rebuildFlat(st.sim.grid);
    arena.rebuildSolid(st.sim.grid);
    st.gridVer = st.sim.gridVer;
    base.reset();
    for (const o of st.toasts) o.el.remove();
    st.toasts = [];
    if (!st.demo) setupHud();
  }

  function startGame(players, opts = {}) {
    firstGesture();
    SFX.click();
    st.players = players;
    st.custom = opts.custom || null;
    settings.lastPlayers = players;
    saveSettings();
    loadStage(opts.stage || st.stageNo, { carry: null });
    beginIntro();
  }

  function beginIntro() {
    setMode('intro');
    show(null);
    $('curtain').classList.remove('hidden');
    $('curtainStage').textContent = st.custom ? st.custom.name : `STAGE ${st.stageNo}`;
    $('curtainName').textContent = st.custom ? 'YOUR OWN MAP!' : st.sim.stage.name;
    SFX.jingle();
    Kit.sound.music('over');
  }

  function updateIntro() {
    const t = st.modeT;
    const close = t < 0.3 ? smooth(t / 0.3) : t < 1.7 ? 1 : 1 - smooth(clamp((t - 1.7) / 0.4, 0, 1));
    const top = document.querySelector('#curtain .top'), bot = document.querySelector('#curtain .bot');
    top.style.transform = `translateY(${-(1 - close) * 100}%)`;
    bot.style.transform = `translateY(${(1 - close) * 100}%)`;
    document.querySelector('#curtain .txt').style.opacity = String(t > 0.25 && t < 1.75 ? 1 : 0);
    if (t >= 2.1) {
      $('curtain').classList.add('hidden');
      setMode('play');
    }
  }

  function pause() {
    if (st.mode !== 'play') return;
    st.prev = 'play';
    setMode('pause');
    show('pause');
    clearInput();
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    show(null);
    setMode('play');
    Kit.sound.music('over');
  }

  function restartStage() {
    show(null);
    st.carry = st.stageCarry || null;
    loadStage(st.stageNo, { carry: st.carry });
    beginIntro();
  }

  function toMenu() {
    if (st.mode === 'build') editor.close();
    show('title');
    $('curtain').classList.add('hidden');
    st.custom = null;
    startDemo();
    setMode('title');
    refreshTitle();
    Kit.sound.music('title');
  }

  function startDemo() {
    const pool2 = [1, 2, 4, 6, 8, 9, 10, 14];
    const no = pool2[Math.floor(Math.random() * pool2.length)];
    const keep = st.stageNo;
    st.players = ['teddy', 'tommy'];
    loadStage(no, { demo: true, players: ['teddy', 'tommy'], level: 'normal' });
    st.players = settings.lastPlayers || ['teddy'];
    st.stageNo = keep;
  }

  function carryOf(S) {
    return S.players.map((P) => ({ reserve: P.reserve, star: P.star, score: P.score }));
  }

  // Stage cleared: the brothers come home and celebrate.
  function startCelebrate() {
    const S = st.sim;
    st.stageCarry = null;
    st.carry = carryOf(S);
    for (const P of S.players) if (P.out) st.carry[P.i].reserve = 0;
    if (!st.custom) {
      best[st.level] = Math.max(best[st.level], st.stageNo);
      best.hi = Math.max(best.hi, ...S.players.map((P) => P.score));
      store.set('tankTT.best', best);
    }
    for (const v of views.values()) { fx.sparkle(v.root.position.x, v.root.position.z, 0.5, 1.4, 0.5); dropView(v); }
    views.clear();
    for (const [, v] of shellViews) scene.remove(v);
    shellViews.clear();
    if (powerView) { scene.remove(powerView); powerView = powerRef = null; }
    markers.forEach((m) => { m.visible = false; });
    st.cel = { tanks: [], t: 0 };
    for (const kind of ['teddy', 'tommy']) {
      const v = takeView({ kind, variant: 'player', team: 'ally', dir: 0 });
      const [sx, sy] = M.PLAYER_SPAWN[kind];
      v.root.position.set(A.wx(sx + 1), 0, A.wx(sy + 1));
      v.celeb = true;
      fx.sparkle(v.root.position.x, v.root.position.z, 0.6, 2, 0.6);
      fx.stars(v.root.position.x, v.root.position.z, 8);
      st.cel.tanks.push({ v, kind, seg: 0, segT: 0, ball: false });
    }
    setMode('celebrate');
    banner(`${st.custom ? 'MAP' : 'STAGE ' + st.stageNo} CLEAR!<small>THE COOKIES ARE SAFE!</small>`, 2.6);
    SFX.fanfare();
  }

  function updateCelebrate(dt) {
    st.cel.t += dt;
    const k = st.cel.t;
    if (Math.floor(k * 3) !== Math.floor((k - dt) * 3) && k < 4.5) fx.confetti(0, 5.2, 14);
    for (const c of st.cel.tanks) {
      const v = c.v, p = v.person;
      const climb = smooth(clamp((k - 0.6) / 0.7, 0, 1));
      const s = lerp(v.ps, 0.44, climb);
      p.root.scale.setScalar(s);
      p.head.scale.setScalar(lerp(1.45, 1.12, climb));
      let mode = climb < 1 ? 'wave' : 'peace', hop = 0;
      v.phase += dt * 6;
      if (climb >= 1) {
        c.segT += dt;
        if (c.kind === 'teddy') {
          const segs = [['boxing', 2.0], ['jumpshot', 1.1]];
          if (c.segT > segs[c.seg][1]) { c.seg = (c.seg + 1) % segs.length; c.segT = 0; c.ball = false; }
          mode = segs[c.seg][0];
          if (mode === 'jumpshot') {
            const j = c.segT / 1.1;
            hop = Math.sin(clamp(j / 0.7, 0, 1) * Math.PI) * 0.35;
            if (!c.ball && j > 0.35) {
              c.ball = true;
              p.root.updateMatrixWorld(true);
              const hp = Kit.people.handWorld(p, 1);
              fx.emoji('🏀', hp.x, hp.z, { y: hp.y + 0.1, vx: 0.6, vy: 5.5, vz: -2.2, g: 8, life: 1.3, size: 0.32, spin: -8, fade: 0.2 });
              play('swish');
            }
          }
        } else {
          mode = 'peace';
          hop = Math.abs(Math.sin(c.segT * 5)) * 0.12;
        }
      }
      Kit.people.pose(p, v.phase, mode, 1 - Math.exp(-14 * dt));
      settle(p);
      p.head.rotation.x = 0.15;
      p.root.position.y = lerp(-1.08 * v.ps, 0.03 + hop, climb);
      v.holder.rotation.y = Math.PI + (c.kind === 'teddy' && mode === 'boxing' ? -0.5 : 0);
      v.body.rotation.y = 0;
      v.shield.visible = false;
    }
    if (k > 5.6 && st.mode === 'celebrate') showTally();
  }

  function showTally() {
    const S = st.sim;
    const last = !st.custom && st.stageNo >= TT.STAGES.length;
    setMode('tally');
    show('tally');
    $('tallyTitle').textContent = last ? 'ALL COOKIES SAFE!' : `${st.custom ? 'MAP' : 'STAGE ' + st.stageNo} CLEAR!`;
    const two = S.players.length === 2;
    const g = $('tallyGrid');
    g.style.gridTemplateColumns = two ? 'auto auto auto' : 'auto auto';
    let html = `<span></span>${S.players.map((P) => `<span class="h">${NAMES[P.kind]}</span>`).join('')}`;
    const pts = { basic: 100, fast: 200, power: 300, armor: 400 };
    const label = { basic: 'BASIC', fast: 'FAST', power: 'POWER', armor: 'ARMOR' };
    for (const v of M.FOE_ORDER) {
      html += `<span><img src="${icons[v]}" alt=""> ${label[v]}</span>`;
      html += S.players.map((P) => `<span>${P.kills[v]} × ${pts[v]}</span>`).join('');
    }
    html += `<span class="h">SCORE</span>${S.players.map((P) => `<span class="tot">${P.score}</span>`).join('')}`;
    g.innerHTML = html;
    const kills = S.players.reduce((n, P) => n + M.FOE_ORDER.reduce((m, v) => m + P.kills[v], 0), 0);
    $('tallySub').textContent = last ? `You beat all ${TT.STAGES.length} stages! Teddy and Tommy are the cookie champions!` : `${kills} zombie tank${kills === 1 ? '' : 's'} went POOF!${st.custom ? '' : ' Next: ' + TT.STAGES[st.stageNo].name}`;
    $('nextBtn').textContent = last ? '🏆 MENU' : st.custom ? '🛠️ BACK TO BUILD' : 'NEXT STAGE ▶';
    if (!st.custom && !last) { settings.stage = st.stageNo + 1; saveSettings(); }
    Kit.sound.music('title');
  }

  function nextStage() {
    SFX.click();
    if (st.custom) { const slot = st.custom.slot; st.custom = null; openBuild(slot); return; }
    if (st.stageNo >= TT.STAGES.length) { toMenu(); return; }
    st.stageCarry = st.carry;
    loadStage(st.stageNo + 1, { carry: st.carry });
    show(null);
    beginIntro();
  }

  function showOver() {
    const S = st.sim;
    setMode('over');
    show('over');
    const baseLost = S.over === 'base';
    $('overEmoji').textContent = baseLost ? '🍪' : '🛞';
    $('overTitle').textContent = baseLost ? 'OH NO!' : 'OUT OF TANKS!';
    $('overSub').textContent = baseLost
      ? 'The zombies got the cookies! Try again — call your brother to guard the jar.'
      : `So close! ${S.foesLeft()} zombie tanks left. Try again — a 🪖 or ⭐ helps a lot.`;
    Kit.sound.music('title');
  }

  function retry() {
    SFX.click();
    show(null);
    st.carry = null;
    loadStage(st.stageNo, { carry: null });
    beginIntro();
  }

  // ---------------------------------------------------------------- HUD

  let hudCache = {};
  function setText(el, key, text) {
    if (hudCache[key] === text) return;
    hudCache[key] = text;
    el.textContent = text;
  }

  function setupHud() {
    hudCache = {};
    const S = st.sim;
    const two = S.players.length === 2;
    S.players.forEach((P, i) => {
      const card = $('card' + i);
      card.querySelector('.face img').src = faces[P.kind];
      card.querySelector('.nm span').textContent = NAMES[P.kind];
      card.querySelector('.lives img').src = icons[P.kind];
      card.querySelector('.who').textContent = two ? (i ? '2P' : '1P') : '1P';
      card.querySelector('.face').style.background = P.kind === 'tommy' ? 'radial-gradient(circle at 50% 35%, #d8fff0, #3fae8b)' : '';
    });
    $('card1').classList.toggle('hidden', !two);
    const foes = $('foes');
    foes.innerHTML = '';
    for (let i = 0; i < 20; i++) { const img = document.createElement('img'); img.src = icons.foe; img.alt = ''; foes.appendChild(img); }
    $('stageNo').textContent = st.custom ? '★' : String(st.stageNo);
    $('stageName').textContent = st.custom ? st.custom.name : S.stage.name;
    const bud = $('budBtn');
    const pics = bud.querySelectorAll('.pics img');
    bud.classList.toggle('two', two);
    if (two) {
      pics[0].src = faces.teddy;
      pics[1].src = faces.tommy;
      pics[1].classList.remove('hidden');
      bud.querySelector('small').textContent = 'BROTHER POWER';
      bud.querySelector('kbd').textContent = 'T';
    } else {
      pics[0].src = faces[S.buddyKind];
      pics[1].classList.add('hidden');
      bud.querySelector('small').textContent = `CALL ${NAMES[S.buddyKind]}`;
      bud.querySelector('kbd').textContent = 'T';
      $('budBar').querySelector('img').src = faces[S.buddyKind];
    }
    $('fire0').firstChild.textContent = S.players[0].kind === 'tommy' ? '✌️' : '🏀';
  }

  function updateHud() {
    const S = st.sim;
    if (!S || st.demo) return;
    S.players.forEach((P, i) => {
      const card = $('card' + i);
      setText(card.querySelector('.lives span'), 'l' + i, `× ${P.out ? 0 : P.reserve}`);
      setText(card.querySelector('.score'), 's' + i, String(P.score));
      const stars = card.querySelectorAll('.stars i');
      stars.forEach((s, k) => s.classList.toggle('on', P.star > k));
      card.classList.toggle('out', P.out);
      const b = clamp(1 - (st.time - cardBump[i]) / 0.45, 0, 1);
      const key = b > 0 ? b.toFixed(2) : '0';
      if (hudCache['b' + i] !== key) {
        hudCache['b' + i] = key;
        card.style.transform = b > 0 ? `scale(${1 + 0.08 * Math.sin(b * Math.PI)})` : '';
        card.style.background = b > 0 ? `rgba(255, 212, 0, ${0.5 * b})` : '';
      }
    });
    const left = S.queue.length;
    const fkey = left + '/' + S.foesLeft();
    if (hudCache.foes !== fkey) {
      hudCache.foes = fkey;
      const imgs = $('foes').children;
      for (let i = 0; i < imgs.length; i++) imgs[i].classList.toggle('gone', i >= left);
      $('foeN').textContent = `🧟 ${S.foesLeft()}`;
    }
    let timers = '';
    if (S.freezeT > 0) timers += `<span>⏰ ${Math.ceil(S.freezeT)}</span>`;
    if (S.shovelT > 0) timers += `<span>🧱 ${Math.ceil(S.shovelT)}</span>`;
    if (hudCache.timers !== timers) { hudCache.timers = timers; $('timers').innerHTML = timers; }
    const bud = $('budBtn'), bar = $('budBar');
    if (S.two) {
      const cool = S.cheerCool > 0;
      bud.style.setProperty('--fill', String(cool ? 1 - S.cheerCool / S.L.cheerCool : 1));
      bud.classList.toggle('rest', cool);
      bud.classList.toggle('on', S.cheerT > 0);
      bar.classList.add('hidden');
    } else {
      const b = S.buddy;
      const fill = b ? clamp(b.phase === 'bye' ? 0 : b.left / S.visit, 0, 1) : 1;
      bud.style.setProperty('--fill', String(fill));
      bud.classList.toggle('on', !!b);
      bud.classList.remove('rest');
      setText(bud.querySelector('small'), 'budlbl', b ? (b.treatT >= 0 || b.phase === 'enter' ? `${NAMES[S.buddyKind]}!` : 'ANOTHER TREAT?') : `CALL ${NAMES[S.buddyKind]}`);
      bar.classList.toggle('hidden', !b);
      if (b) {
        bar.querySelector('i').style.setProperty('--fill', String(fill));
        bar.querySelector('em').classList.toggle('used', !b.save);
      }
    }
  }

  // ---------------------------------------------------------------- title screen

  function refreshTitle() {
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === st.level)));
    const s = TT.STAGES[st.stageNo - 1];
    const done = best[st.level] >= st.stageNo;
    $('stageLabel').innerHTML = `STAGE ${st.stageNo}${done ? ' ⭐' : ''}<small>${s.name}</small>`;
  }
  function setLevel(l) {
    st.level = l;
    settings.level = l;
    saveSettings();
    refreshTitle();
    SFX.click();
  }
  function pickStage(d) {
    st.stageNo = ((st.stageNo - 1 + d + TT.STAGES.length) % TT.STAGES.length) + 1;
    settings.stage = st.stageNo;
    saveSettings();
    refreshTitle();
    SFX.click();
  }

  function setupTitle() {
    const words = TT.TITLE.toUpperCase().split(/(TT)/);
    $('logoMain').innerHTML = words.map((w) => (w === 'TT' ? '<span class="tt" style="display:inline">TT</span>' : w)).join('');
    document.title = `${TT.TITLE} · Teddy & Tommy`;
    document.querySelectorAll('[data-face]').forEach((img) => { img.src = faces[img.dataset.face]; });
    document.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.play;
      if (p === 'build') openBuild();
      else startGame(p === 'both' ? ['teddy', 'tommy'] : [p]);
    }));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
    document.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => pickStage(Number(b.dataset.s))));
    const help = [['star', 'faster, then 2 shots, then steel buster'], ['helmet', 'shield'], ['shovel', 'steel around the jar'], ['clock', 'freeze zombies'], ['bomb', 'all poof'], ['tank', 'extra tank']];
    $('powerHelp').innerHTML = help.map(([t, txt]) => `<span><img src="${A.powerIcon(t)}" alt="">${txt}</span>`).join('');
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', restartStage);
    $('quitBtn').addEventListener('click', toMenu);
    $('nextBtn').addEventListener('click', nextStage);
    $('tallyMenuBtn').addEventListener('click', toMenu);
    $('retryBtn').addEventListener('click', retry);
    $('overMenuBtn').addEventListener('click', toMenu);
    refreshTitle();
  }

  // ---------------------------------------------------------------- construction mode

  const editor = TT.makeEditor({
    scene, camera, canvas, arena, base, fx, store, A, M, $,
    rect: () => rect,
    takeView, dropView,
    play(map, slot) {
      st.custom = { name: `MY MAP ${slot + 1}`, map, slot };
      st.players = settings.lastPlayers && settings.lastPlayers.length === 2 ? ['teddy', 'tommy'] : settings.lastPlayers || ['teddy'];
      editor.close();
      startGame(st.players, { custom: st.custom, stage: 1 });
    },
    menu() { toMenu(); },
    players: () => settings.lastPlayers || ['teddy'],
    setPlayers(p) { settings.lastPlayers = p; saveSettings(); },
  });

  function openBuild(slot) {
    firstGesture();
    SFX.click();
    clearViews();
    st.sim = null;
    st.demo = false;
    show(null);
    setMode('build');
    editor.open(slot);
    layout();
  }

  // ---------------------------------------------------------------- main loop

  function simRuns() {
    const m = st.mode;
    return m === 'play' || (m === 'title' && st.demo) || (m === 'over' && st.modeT < 3);
  }

  function tick(dt) {
    st.time += dt;
    st.modeT += dt;
    const S = st.sim;
    if (S && simRuns()) {
      st.acc += dt;
      let n = 0;
      while (st.acc >= DT - 1e-9 && n++ < 8) {
        readInput();
        S.step(DT);
        st.acc -= DT;
        for (const e of S.events) onEvent(e, S);
        S.events.length = 0;
      }
      if (st.acc > DT) st.acc = 0;
    }
    if (S && S.gridVer !== st.gridVer) { arena.rebuildSolid(S.grid, st.ringFlash); st.gridVer = S.gridVer; }
    // the shovel's steel blinks back to bricks in its last 3 seconds
    if (S) {
      const want = S.shovelT > 0 && S.shovelT < 3 && Math.floor(st.time * 5) % 2 ? M.BRICK : null;
      if (want !== st.ringFlash) { st.ringFlash = want; arena.rebuildSolid(S.grid, want); }
    }
    if (st.mode === 'intro') updateIntro();
    if (st.cel && (st.mode === 'celebrate' || st.mode === 'tally')) updateCelebrate(dt);
    if (S && st.mode === 'play' && st.clearAt && st.time >= st.clearAt) { st.clearAt = 0; startCelebrate(); }
    if (S && st.overAt && st.time >= st.overAt && (st.mode === 'play' || st.mode === 'over')) {
      st.overAt = 0;
      if (st.demo) startDemo();
      else showOver();
    }
    if (st.demo && S && (S.cleared || S.t > 150)) startDemo();
    // treads rumble while a player drives
    if (S && st.mode === 'play' && !st.demo) {
      st.treadT -= dt;
      if (st.treadT <= 0) {
        const moving = S.players.some((P) => P.tank && P.tank.moving);
        if (moving) { SFX.tread(1); st.treadT = 0.11; } else { SFX.idle(); st.treadT = 0.3; }
      }
    }
    for (let i = st.anims.length - 1; i >= 0; i--) {
      const a = st.anims[i];
      if (a.tick(a, dt)) { if (a.cleanup) a.cleanup(); st.anims.splice(i, 1); }
    }
    syncViews(dt);
    fx.update(dt);
    arena.tick(st.time);
    base.tick(st.time, dt);
    if (st.mode === 'build') editor.tick(dt);
    updateCamera(dt);
    updateHud();
    updateToasts();
    updateBanner();
    if (flashT > 0) { flashT -= dt; flashEl.style.opacity = String(Math.max(0, flashT / flashDur) * 0.8); }
  }

  function render() {
    renderer.render(scene, camera);
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!st.keepAwake) { pause(); Kit.sound.suspend(); }
    } else Kit.sound.resume();
  });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  // ---------------------------------------------------------------- start

  setupTitle();
  $('loading').remove();
  startDemo();
  setMode('title');
  show('title');
  refreshTitle();
  layout();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` and draw (the Browser pane throttles animation while hidden)
    step(seconds = 1 / 60) {
      let n = Math.max(1, Math.round(seconds / DT));
      while (n-- > 0) tick(DT);
      render();
      return game.state();
    },
    // start a game: { players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], stage, level, skipIntro }
    start(o = {}) {
      if (o.level) st.level = o.level;
      if (o.stage) st.stageNo = o.stage;
      startGame(o.players || ['teddy']);
      if (o.skipIntro !== false) { $('curtain').classList.add('hidden'); setMode('play'); }
      return game.state();
    },
    state() {
      const S = st.sim;
      return {
        mode: st.mode, stage: st.stageNo, demo: st.demo, level: st.level,
        foesLeft: S ? S.foesLeft() : null, queue: S ? S.queue.length : null,
        players: S ? S.players.map((P) => ({ kind: P.kind, reserve: P.reserve, star: P.star, score: P.score, out: P.out, tank: P.tank ? { x: +P.tank.x.toFixed(2), y: +P.tank.y.toFixed(2), dir: P.tank.dir, shield: +P.tank.shield.toFixed(1) } : null })) : null,
        buddy: S && S.buddy ? { phase: S.buddy.phase, left: +S.buddy.left.toFixed(1), save: S.buddy.save, x: S.buddy.tank.x, y: S.buddy.tank.y } : null,
        power: S && S.power ? { ...S.power } : null, freeze: S ? S.freezeT : 0, shovel: S ? S.shovelT : 0,
        enemies: S ? S.tanks.filter((t) => t.team === 'enemy').map((t) => ({ kind: t.kind, variant: t.variant, x: t.x, y: t.y, hp: t.hp, flash: t.flash })) : null,
      };
    },
    sim: () => st.sim,
    buddy() { callBuddy(); return game.state().buddy; },
    give(type, i = 0) { return st.sim && st.sim.give(type, i); },
    power(type, x, y) { return st.sim && st.sim.spawnPower(type, x, y); },
    clear() { if (st.sim) st.sim.winNow(); },
    lose() { if (st.sim) { st.sim.baseAlive = false; st.sim.emit('baseLost', {}); st.sim.endGame('base'); } },
    // hold a player's input: game.input(0, { dir: 1, fire: true })
    input(i, o) { const S = st.sim; if (S) Object.assign(S.input[i], o); },
    autopilot(on = true) { if (st.sim) st.sim.auto = [on, on]; },
    keepAwake(on = true) { st.keepAwake = on; },
    // close-up camera for checking details: game.peek(x, z, dist, elevation); game.peek() to go back
    peek(x, z, dist = 6, el = 0.9) { st.peek = x === undefined ? null : { x, z, dist, el }; render(); },
    freeze(on = true) { st.frozen = on; },
    menu: toMenu,
    build: (slot) => openBuild(slot),
    editor: () => editor,
    check: () => TT.check.maps().concat(TT.check.sabotage()),
    soak: (o) => TT.check.soak(o),
    layout,
    st,
  };
})();
