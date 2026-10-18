/* Tank TT: 🛠 Construction mode. Kids paint their own arena on the same 3D board, tile by tile, then play it.
   Three map slots are saved in localStorage ('tankTT.maps'). The stage check runs after every stroke: if a zombie
   gate or a start gets walled in by steel or water, the message says so and 🔧 FIX IT opens a path
   (steel on the way becomes bricks, water becomes ground). */
(function () {
  'use strict';
  const TT = window.TT;

  TT.makeEditor = function (ctx) {
    const T = THREE;
    const { scene, camera, canvas, arena, A, M, $, store } = ctx;
    const TOOLS = [
      { ch: '#', name: 'BRICK', tex: 'brick' },
      { ch: '@', name: 'STEEL', tex: 'steel' },
      { ch: '~', name: 'WATER', tex: 'water' },
      { ch: '%', name: 'TREES', tex: 'leaf' },
      { ch: '-', name: 'ICE', tex: 'ice' },
      { ch: '.', name: 'ERASE', emoji: '🧽' },
    ];
    const FOES = [12, 4, 2, 2];

    function blank() {
      const rows = [];
      for (let y = 0; y < 13; y++) {
        let r = '';
        for (let x = 0; x < 13; x++) r += M.fixedTile(x, y) || '.';
        rows.push(r);
      }
      return rows;
    }
    function starter() { // slot 1 starts with a little something to play with
      const r = blank().map((s) => s.split(''));
      for (const [x, y] of [[2, 3], [3, 3], [9, 3], [10, 3], [2, 4], [10, 4], [5, 6], [6, 6], [7, 6], [2, 9], [3, 9], [9, 9], [10, 9]]) r[y][x] = '#';
      r[6][1] = r[6][11] = '%';
      return r.map((a) => a.join(''));
    }

    let maps = store.get('tankTT.maps', null);
    if (!Array.isArray(maps) || maps.length !== 3) maps = [starter(), blank(), blank()];
    maps = maps.map((m) => (Array.isArray(m) && m.length === 13 ? m.map((r) => String(r).padEnd(13, '.').slice(0, 13)) : blank()));
    let slot = 0, tool = 0, painting = false, problems = [], clearArm = 0, built = false, open = false;
    const cursor = { x: 6, y: 6, show: false };
    const save = () => store.set('tankTT.maps', maps);

    // ---------------- the board overlay: grid lines, a cursor, the gates and the starts

    const group = new T.Group();
    group.visible = false;
    scene.add(group);
    const lp = [];
    for (let i = 0; i <= 13; i++) {
      const v = i - 6.5;
      lp.push(-6.5, 0.03, v, 6.5, 0.03, v, v, 0.03, -6.5, v, 0.03, 6.5);
    }
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3));
    group.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18 })));
    const cur = new T.Group();
    const curBox = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 0.7, 1)), new T.LineBasicMaterial({ color: '#ffd400' }));
    curBox.position.y = 0.35;
    const curFill = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.25, depthWrite: false }));
    curFill.rotation.x = -Math.PI / 2;
    curFill.position.y = 0.04;
    cur.add(curBox, curFill);
    group.add(cur);
    const gates = M.FOE_SPAWN.map(([x, y]) => {
      const s = A.spriteOf(A.tex.sparkle, 1.2, { blending: T.AdditiveBlending });
      s.position.set(A.wx(x + 1), 0.5, A.wx(y + 1));
      group.add(s);
      return s;
    });
    let starts = [];

    // ---------------- UI

    function buildUi() {
      if (built) return;
      built = true;
      const tools = $('tools');
      tools.innerHTML = '';
      TOOLS.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = 'tool';
        b.setAttribute('role', 'radio');
        const sw = t.emoji ? `<i>${t.emoji}</i>` : `<i style="background:url(${A.tex[t.tex].image.toDataURL()}) center/cover;border:2px solid #14121f"></i>`;
        b.innerHTML = `${sw}<span>${t.name} <kbd>${i + 1}</kbd></span>`;
        b.addEventListener('click', () => pickTool(i));
        tools.appendChild(b);
      });
      const who = document.createElement('div');
      who.className = 'seg';
      who.id = 'buildWho';
      who.style.justifyContent = 'center';
      who.innerHTML = '<button data-who="teddy">TEDDY</button><button data-who="tommy">TOMMY</button><button data-who="both">BOTH</button>';
      $('buildRight').insertBefore(who, $('buildMsg'));
      who.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        ctx.setPlayers(b.dataset.who === 'both' ? ['teddy', 'tommy'] : [b.dataset.who]);
        refreshWho();
        TT.sfx.click();
      }));
      document.querySelectorAll('#slots .slot').forEach((b) => b.addEventListener('click', () => pickSlot(Number(b.dataset.slot))));
      $('buildPlay').addEventListener('click', play);
      $('buildFix').addEventListener('click', fixIt);
      $('buildRandom').addEventListener('click', surprise);
      $('buildClear').addEventListener('click', clearMap);
      $('buildMenu').addEventListener('click', () => ctx.menu());
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', () => { painting = false; });
      canvas.addEventListener('pointerleave', () => { if (!painting) cursor.show = false; });
    }

    function refreshWho() {
      const p = ctx.players();
      const id = p.length === 2 ? 'both' : p[0];
      document.querySelectorAll('#buildWho button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === id)));
    }

    function pickTool(i) {
      tool = i;
      document.querySelectorAll('#tools .tool').forEach((b, k) => b.setAttribute('aria-checked', String(k === i)));
      TT.sfx.click();
    }

    function pickSlot(i) {
      slot = i;
      document.querySelectorAll('#slots .slot').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.slot) === i)));
      clearArm = 0;
      $('buildClear').textContent = '🗑️ CLEAR';
      rebuild();
      TT.sfx.click();
    }

    // ---------------- painting

    const ray = new T.Raycaster(), ndc = new T.Vector2(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
    function tileAt(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(floor, hit)) return null;
      const x = Math.floor(hit.x + 6.5), y = Math.floor(hit.z + 6.5);
      return x >= 0 && y >= 0 && x < 13 && y < 13 ? { x, y } : null;
    }
    function onDown(e) {
      if (!open) return;
      const t = tileAt(e);
      if (!t) return;
      Kit.sound.init();
      painting = true;
      cursor.x = t.x; cursor.y = t.y; cursor.show = true;
      paint(t.x, t.y, true);
    }
    function onMove(e) {
      if (!open) return;
      const t = tileAt(e);
      if (!t) { if (!painting) cursor.show = false; return; }
      cursor.x = t.x; cursor.y = t.y; cursor.show = true;
      if (painting && (e.buttons || e.pointerType === 'touch')) paint(t.x, t.y, false);
    }

    function paint(x, y, tap) {
      if (M.fixedTile(x, y)) { if (tap) TT.sfx.nope(); return; }
      const ch = TOOLS[tool].ch;
      const row = maps[slot][y];
      if (row[x] === ch) return;
      maps[slot][y] = row.slice(0, x) + ch + row.slice(x + 1);
      save();
      rebuild();
      TT.sfx.paint();
    }

    function rebuild() {
      const { grid } = M.parseMap(maps[slot]);
      arena.rebuildFlat(grid);
      arena.rebuildSolid(grid);
      problems = TT.check.mapProblems({ map: maps[slot], foes: FOES });
      const msg = $('buildMsg');
      if (!problems.length) {
        msg.textContent = '✅ Ready! Press PLAY to drive it.';
        msg.classList.remove('bad');
        $('buildFix').classList.add('hidden');
      } else {
        msg.textContent = `⚠️ ${problems[0][0].toUpperCase()}${problems[0].slice(1)}. Leave a gap, or tap FIX IT.`;
        msg.classList.add('bad');
        $('buildFix').classList.remove('hidden');
      }
    }

    // Open a path from every walled-in gate or start to the cookie jar: steel on the way turns to bricks,
    // water turns to ground. A tile-sized path is wide enough for a tank.
    function fixRows(rows) {
      const g = rows.map((r) => r.split(''));
      const hard = (ch) => '@~LRUD'.includes(ch);
      const cost = (ch) => (hard(ch) ? 40 : '#lrud'.includes(ch) ? 3 : 1);
      const blocked = (x, y) => (y === 12 && x >= 5 && x <= 7) || (y === 11 && x >= 5 && x <= 7);
      const goals = new Set(['6,10', '5,10', '7,10', '4,11', '8,11']);
      for (const [sx, sy] of [[0, 0], [6, 0], [12, 0], [4, 12], [8, 12]]) {
        const dist = new Map([[`${sx},${sy}`, 0]]), prev = new Map();
        const open2 = [[0, sx, sy]];
        let end = null;
        while (open2.length) {
          open2.sort((a, b) => a[0] - b[0]);
          const [d, x, y] = open2.shift();
          if (d > dist.get(`${x},${y}`)) continue;
          if (goals.has(`${x},${y}`)) { end = [x, y]; break; }
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx > 12 || ny > 12 || blocked(nx, ny)) continue;
            const nd = d + cost(g[ny][nx]);
            if (nd < (dist.get(`${nx},${ny}`) ?? Infinity)) { dist.set(`${nx},${ny}`, nd); prev.set(`${nx},${ny}`, [x, y]); open2.push([nd, nx, ny]); }
          }
        }
        for (let p = end; p; p = prev.get(`${p[0]},${p[1]}`)) {
          const ch = g[p[1]][p[0]];
          if (ch === '@') g[p[1]][p[0]] = '#';
          else if (ch === '~') g[p[1]][p[0]] = '.';
          else if ('LRUD'.includes(ch)) g[p[1]][p[0]] = ch.toLowerCase();
        }
      }
      return g.map((r) => r.join(''));
    }

    function fixIt() {
      let rows = maps[slot];
      for (let i = 0; i < 4 && TT.check.mapProblems({ map: rows, foes: FOES }).length; i++) rows = fixRows(rows);
      maps[slot] = rows;
      save();
      rebuild();
      TT.sfx.shovel();
    }

    // A random mirrored map, made playable.
    function surprise() {
      const pick = () => {
        const r = Math.random();
        return r < 0.55 ? '.' : r < 0.8 ? '#' : r < 0.86 ? '@' : r < 0.92 ? '%' : r < 0.96 ? '~' : '-';
      };
      const g = blank().map((r) => r.split(''));
      for (let y = 1; y < 13; y++) {
        for (let x = 0; x <= 6; x++) {
          if (M.fixedTile(x, y) || M.fixedTile(12 - x, y)) continue;
          const ch = y === 1 && Math.random() < 0.7 ? '.' : pick();
          g[y][x] = ch;
          g[y][12 - x] = ch;
        }
      }
      let rows = g.map((r) => r.join(''));
      for (let i = 0; i < 4 && TT.check.mapProblems({ map: rows, foes: FOES }).length; i++) rows = fixRows(rows);
      maps[slot] = rows;
      save();
      rebuild();
      TT.sfx.powerAppear();
    }

    function clearMap() {
      if (!clearArm || performance.now() - clearArm > 2500) {
        clearArm = performance.now();
        $('buildClear').textContent = '🗑️ SURE? TAP AGAIN';
        TT.sfx.click();
        return;
      }
      clearArm = 0;
      $('buildClear').textContent = '🗑️ CLEAR';
      maps[slot] = blank();
      save();
      rebuild();
      TT.sfx.brick();
    }

    function play() {
      if (problems.length) { TT.sfx.nope(); $('buildFix').classList.remove('hidden'); return; }
      ctx.play(maps[slot].slice(), slot);
    }

    // ---------------- keyboard: a cursor like the arcade's construction screen

    function key(e) {
      const c = e.code;
      const mv = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[c];
      if (mv) {
        e.preventDefault();
        cursor.x = Math.max(0, Math.min(12, cursor.x + mv[0]));
        cursor.y = Math.max(0, Math.min(12, cursor.y + mv[1]));
        cursor.show = true;
        if (e.shiftKey) paint(cursor.x, cursor.y, false);
        return;
      }
      if (c === 'Space' || c === 'KeyF') { e.preventDefault(); cursor.show = true; paint(cursor.x, cursor.y, true); return; }
      if (c === 'Backspace' || c === 'Delete') { const t = tool; tool = 5; paint(cursor.x, cursor.y, true); tool = t; return; }
      const n = Number(c.replace('Digit', '').replace('Numpad', ''));
      if (n >= 1 && n <= 6) { pickTool(n - 1); return; }
      if (c === 'Enter') { play(); return; }
      if (c === 'Escape') ctx.menu();
    }

    function tick(dt) {
      cur.visible = cursor.show;
      cur.position.set(cursor.x - 6, 0, cursor.y - 6);
      curBox.material.color.setHSL(0.14, 1, 0.5 + Math.sin(performance.now() / 150) * 0.15);
      const t = performance.now() / 1000;
      gates.forEach((s, i) => { const k = 0.8 + Math.abs(Math.sin(t * 3 + i)) * 0.5; s.scale.set(k, k, 1); s.material.rotation = t * 2; });
    }

    return {
      open(s) {
        buildUi();
        open = true;
        group.visible = true;
        ctx.base.reset();
        starts = ['teddy', 'tommy'].map((kind) => {
          const v = ctx.takeView({ kind, variant: 'player', team: 'ally', dir: 0 });
          const [x, y] = M.PLAYER_SPAWN[kind];
          v.root.position.set(A.wx(x + 1), 0, A.wx(y + 1));
          return v;
        });
        pickTool(tool);
        refreshWho();
        pickSlot(typeof s === 'number' ? s : slot);
      },
      close() {
        open = false;
        group.visible = false;
        painting = false;
        for (const v of starts) ctx.dropView(v);
        starts = [];
      },
      key, tick,
      maps: () => maps,
      paint: (x, y, ch) => { const i = TOOLS.findIndex((t) => t.ch === ch); if (i >= 0) tool = i; paint(x, y, true); },
      problems: () => problems,
      fix: fixIt, surprise, slot: (i) => pickSlot(i),
    };
  };
})();
