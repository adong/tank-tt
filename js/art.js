/* Tank TT: everything you see. Canvas textures; the arena (bricks, steel, water, trees, ice) and its grey frame;
   the cookie jar; blocky tanks with a kid (or a zombie, or a robot) popping out of the hatch; shells, power-ups,
   treats and cartoon effects. No image files: everything is painted on canvases or built from boxes.
   World units: one tile = 1. Cell (x, y) of the rules sits at world (x / 2 - 6.5, 0, y / 2 - 6.5); up the screen is -z. */
(function () {
  'use strict';
  const T = THREE;
  const TT = window.TT;
  const G = Kit.gfx;
  const M = TT.sim;
  const N = M.N;
  const INK = '#14121f';

  const wx = (c) => c / 2 - 6.5;

  function hexShade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), to = amt < 0 ? 0 : 255, k = Math.abs(amt);
    const ch = (v) => Math.round(v + (to - v) * k);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
  }

  // ---------------------------------------------------------------- textures

  const tex = {};

  function brickTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#ead2b4';
    g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 16 : 0;
      for (let x = -32 + off; x < 64; x += 32) {
        const y = r * 16;
        g.fillStyle = '#cf5a2c';
        g.fillRect(x + 1.5, y + 1.5, 29, 13);
        g.fillStyle = '#f08550';
        g.fillRect(x + 1.5, y + 1.5, 29, 3);
        g.fillStyle = '#93391a';
        g.fillRect(x + 1.5, y + 11.5, 29, 3);
      }
    }
    return G.toTexture(c);
  }

  function steelTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#aab1be';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#f2f5fa';
    g.fillRect(0, 0, 64, 6);
    g.fillRect(0, 0, 6, 64);
    g.fillStyle = '#5f6674';
    g.fillRect(0, 58, 64, 6);
    g.fillRect(58, 0, 6, 64);
    g.fillStyle = '#e4e8ef';
    g.fillRect(18, 18, 28, 28);
    g.fillStyle = '#7d8492';
    g.fillRect(18, 42, 28, 4);
    g.fillRect(42, 18, 4, 28);
    g.fillStyle = '#5f6674';
    for (const [x, y] of [[11, 11], [53, 11], [11, 53], [53, 53]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    return G.toTexture(c);
  }

  function waterTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    const gr = g.createLinearGradient(0, 0, 128, 128);
    gr.addColorStop(0, '#2f86ea');
    gr.addColorStop(1, '#2568cc');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(220,240,255,0.85)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 2; k++) {
        const x = k * 64 + (r % 2 ? 32 : 0), y = 20 + r * 32;
        g.beginPath();
        g.arc(x + 16, y, 10, Math.PI * 0.15, Math.PI * 0.85);
        g.stroke();
      }
    }
    const t = G.toTexture(c, true);
    return t;
  }

  function iceTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#d6efff';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 4;
    for (const [x, y, l] of [[8, 30, 22], [30, 56, 18], [40, 18, 16]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y - l); g.stroke(); }
    g.strokeStyle = 'rgba(120,180,230,0.45)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, 62, 62);
    return G.toTexture(c);
  }

  function leafTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#3c9e48';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = i % 3 ? '#5fc35f' : '#2b7a37';
      g.beginPath();
      g.arc((i * 37) % 64, (i * 23 + (i >> 2) * 7) % 64, 4 + (i % 3), 0, Math.PI * 2);
      g.fill();
    }
    return G.toTexture(c);
  }

  function groundTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#272a35';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)';
      g.fillRect((i * 29) % 64, (i * 17) % 64, 3, 3);
    }
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 64, 64);
    return G.toTexture(c, true);
  }

  function frameTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#8e929c';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 80; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      g.fillRect((i * 13) % 64, (i * 31) % 64, 2, 2);
    }
    return G.toTexture(c, true);
  }

  function treadTexture(across) {
    const [c, g] = G.makeCanvas(32, 32);
    g.fillStyle = '#2a2b31';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#5a5c66';
    for (let k = 0; k < 4; k++) {
      if (across) g.fillRect(0, k * 8, 32, 3); else g.fillRect(k * 8, 0, 3, 32);
    }
    return G.toTexture(c, true);
  }

  // A four-pointed twinkle, for spawn sparkles and treats.
  function sparkleTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.2, 'rgba(255,250,200,0.8)');
    gr.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 10 : 62, a = (i * Math.PI) / 4;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    return G.toTexture(c);
  }

  // A comic starburst with a word in it (POW!, POP!, BONK!...), in the chosen language (Kit.lang).
  const burstCache = {};
  function burstTexture(en, fill = '#ffd400') {
    const word = Kit.lang ? Kit.lang.t(en) : en;
    const key = word + fill;
    if (burstCache[key]) return burstCache[key];
    const [c, g] = G.makeCanvas(256, 256);
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 78 : 120, a = (i * Math.PI) / 12 + 0.1;
      g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.8);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    let px = 58;
    g.font = `${px}px ${G.FONT}`;
    while (g.measureText(word).width > 196 && px > 26) g.font = `${(px -= 4)}px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.strokeText(word, 128, 132);
    g.fillStyle = '#ffffff';
    g.fillText(word, 128, 132);
    return (burstCache[key] = G.toTexture(c));
  }

  // Floating text without a burst (points: "+200").
  const textCache = {};
  function textTexture(text, color = '#ffffff') {
    const key = text + color;
    if (textCache[key]) return textCache[key];
    const [c, g] = G.makeCanvas(256, 96);
    g.font = `56px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = INK;
    g.strokeText(text, 128, 52);
    g.fillStyle = color;
    g.fillText(text, 128, 52);
    return (textCache[key] = G.toTexture(c));
  }

  // The extra-tank power-up: a little tank with +1.
  function miniTankCanvas(g, x, y, s, hull, stripe) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = '#2a2b31';
    g.fillRect(-30, -26, 14, 52);
    g.fillRect(16, -26, 14, 52);
    g.fillStyle = hull;
    G.roundRect(g, -18, -20, 36, 42, 6);
    g.fill();
    g.fillStyle = stripe;
    g.fillRect(-30, -26, 4, 52);
    g.fillRect(26, -26, 4, 52);
    g.fillStyle = hexShade(hull, -0.25);
    g.fillRect(-4, -40, 8, 26);
    g.fillStyle = hexShade(hull, 0.2);
    G.roundRect(g, -12, -10, 24, 22, 5);
    g.fill();
    g.restore();
  }

  const powerCache = {};
  const POWER_EMOJI = { star: '⭐', helmet: '🪖', shovel: '🧱', clock: '⏰', bomb: '💣' };
  function powerTexture(type) {
    if (powerCache[type]) return powerCache[type];
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = INK;
    G.roundRect(g, 6, 6, 116, 116, 24);
    g.fill();
    const gr = g.createLinearGradient(0, 10, 0, 118);
    gr.addColorStop(0, '#fff7c2');
    gr.addColorStop(1, '#ffc93a');
    g.fillStyle = gr;
    G.roundRect(g, 13, 13, 102, 102, 18);
    g.fill();
    if (type === 'tank') {
      miniTankCanvas(g, 56, 70, 1.05, '#3f86e8', '#e53935');
      g.font = `34px ${G.FONT}`;
      g.textAlign = 'center';
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.strokeText('+1', 92, 44);
      g.fillStyle = '#ffffff';
      g.fillText('+1', 92, 44);
    } else {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `72px ${G.EMOJI_FONT}`;
      g.fillText(POWER_EMOJI[type], 64, 70);
    }
    return (powerCache[type] = G.toTexture(c));
  }

  function powerIcon(type) { // a data URL for the HUD and the help screen
    const t = powerTexture(type);
    return t.image.toDataURL();
  }

  function initTextures() {
    tex.brick = brickTexture();
    tex.steel = steelTexture();
    tex.water = waterTexture();
    tex.ice = iceTexture();
    tex.leaf = leafTexture();
    tex.ground = groundTexture();
    tex.frame = frameTexture();
    tex.treadAcross = treadTexture(true);
    tex.treadAlong = treadTexture(false);
    tex.sparkle = sparkleTexture();
    tex.dot = G.dotTexture();
    tex.glow = G.glowTexture();
  }

  // ---------------------------------------------------------------- the arena

  function makeArena(scene) {
    const group = new T.Group();
    scene.add(group);

    tex.ground.repeat.set(13, 13);
    const ground = new T.Mesh(new T.PlaneGeometry(13, 13), G.std('#ffffff', { map: tex.ground, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // the grey frame around the arena, like the classic cabinet screen
    tex.frame.repeat.set(4, 4);
    const frameMat = G.std('#ffffff', { map: tex.frame, roughness: 0.9 });
    const rim = 0.6;
    for (const [w, d, x, z] of [[13 + rim * 2, rim, 0, -6.5 - rim / 2], [13 + rim * 2, rim, 0, 6.5 + rim / 2], [rim, 13, -6.5 - rim / 2, 0], [rim, 13, 6.5 + rim / 2, 0]]) {
      const m = G.mesh(new T.BoxGeometry(w, 0.32, d), frameMat, x, 0.16, z, group);
      m.receiveShadow = true;
    }
    const plaza = new T.Mesh(new T.PlaneGeometry(80, 80), G.std('#7b7f89', { roughness: 1 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = -0.02;
    plaza.receiveShadow = true;
    group.add(plaza);

    const brickMat = G.std('#ffffff', { map: tex.brick, roughness: 0.85 });
    const steelMat = G.std('#ffffff', { map: tex.steel, roughness: 0.45, metalness: 0.25 });
    const bricks = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.5, 0.5).translate(0, 0.25, 0), brickMat, N * N);
    const steel = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.56, 0.5).translate(0, 0.28, 0), steelMat, N * N);
    for (const m of [bricks, steel]) {
      m.castShadow = m.receiveShadow = true;
      m.count = 0;
      group.add(m);
    }
    const leafMat = G.std('#ffffff', { map: tex.leaf, roughness: 0.9 });
    const trees = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), leafMat, N * N * 2);
    trees.castShadow = true;
    trees.count = 0;
    group.add(trees);

    tex.water.repeat.set(1, 1);
    const waterMat = new T.MeshStandardMaterial({ map: tex.water, roughness: 0.2, metalness: 0.1 });
    const iceMat = new T.MeshStandardMaterial({ map: tex.ice, color: '#bfe2ff', roughness: 0.35, metalness: 0.05 });
    let water = null, ice = null;
    const m4 = new T.Matrix4(), q = new T.Quaternion(), pos = new T.Vector3(), scl = new T.Vector3(), eul = new T.Euler();

    // flat quads for one cell type, as one mesh
    function flat(grid, type, y, mat) {
      const P = [], U = [], I = [];
      for (let cy = 0; cy < N; cy++) {
        for (let cx = 0; cx < N; cx++) {
          if (grid[cy * N + cx] !== type) continue;
          const x0 = wx(cx), z0 = wx(cy), k = P.length / 3;
          P.push(x0, y, z0, x0 + 0.5, y, z0, x0, y, z0 + 0.5, x0 + 0.5, y, z0 + 0.5);
          const u0 = (cx % 2) * 0.5, v0 = 1 - (cy % 2) * 0.5;
          U.push(u0, v0, u0 + 0.5, v0, u0, v0 - 0.5, u0 + 0.5, v0 - 0.5);
          I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
      }
      if (!P.length) return null;
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
      geo.setIndex(I);
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
      return m;
    }

    // Everything that only changes when a new map loads (or the editor paints): water, ice, trees.
    function rebuildFlat(grid) {
      for (const m of [water, ice]) if (m) { group.remove(m); m.geometry.dispose(); }
      water = flat(grid, M.WATER, 0.015, waterMat);
      ice = flat(grid, M.ICE, 0.01, iceMat);
      let n = 0;
      for (let cy = 0; cy < N; cy++) {
        for (let cx = 0; cx < N; cx++) {
          if (grid[cy * N + cx] !== M.TREES) continue;
          const h = ((cx * 7 + cy * 13) % 5) / 5;
          for (let k = 0; k < 2; k++) {
            const s = k ? 0.4 : 0.62;
            pos.set(wx(cx) + 0.25 + (k ? (h - 0.5) * 0.1 : 0), k ? 0.98 + h * 0.06 : 0.8, wx(cy) + 0.25);
            eul.set(0, (h - 0.5) * 0.6 + k, 0);
            q.setFromEuler(eul);
            scl.set(s, k ? 0.24 : 0.36, s);
            m4.compose(pos, q, scl);
            trees.setMatrixAt(n++, m4);
          }
        }
      }
      trees.count = n;
      trees.instanceMatrix.needsUpdate = true;
    }

    // Bricks and steel, after any shot that breaks something. ringAs: draw the jar's ring as this type (shovel flash).
    function rebuildSolid(grid, ringAs) {
      let nb = 0, ns = 0;
      q.identity();
      scl.set(1, 1, 1);
      for (let cy = 0; cy < N; cy++) {
        for (let cx = 0; cx < N; cx++) {
          let v = grid[cy * N + cx];
          if (ringAs && (v === M.BRICK || v === M.STEEL) && M.RING.some(([x, y]) => x === cx && y === cy)) v = ringAs;
          if (v !== M.BRICK && v !== M.STEEL) continue;
          pos.set(wx(cx) + 0.25, 0, wx(cy) + 0.25);
          m4.compose(pos, q, scl);
          if (v === M.BRICK) bricks.setMatrixAt(nb++, m4);
          else steel.setMatrixAt(ns++, m4);
        }
      }
      bricks.count = nb;
      steel.count = ns;
      bricks.instanceMatrix.needsUpdate = true;
      steel.instanceMatrix.needsUpdate = true;
    }

    function tick(t) {
      tex.water.offset.set((t * 0.12) % 1, Math.sin(t * 1.3) * 0.03);
    }

    return { group, rebuildFlat, rebuildSolid, tick, trees };
  }

  // ---------------------------------------------------------------- the cookie jar

  function chipTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#d99a52';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#5a3418';
    for (const [x, y] of [[14, 16], [40, 12], [28, 34], [50, 40], [12, 46], [36, 54]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    return G.toTexture(c);
  }

  function flagTexture() {
    const [c, g] = G.makeCanvas(128, 88);
    g.fillStyle = '#ffd400';
    g.fillRect(0, 0, 128, 88);
    g.fillStyle = '#ff3d7f';
    g.fillRect(0, 70, 128, 18);
    g.font = `48px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.strokeText('TT', 64, 38);
    g.fillStyle = '#18d4ff';
    g.fillText('TT', 64, 38);
    return G.toTexture(c);
  }

  function makeBase(scene) {
    const root = new T.Group();
    root.position.set(wx(M.BASE_X + 1), 0, wx(M.BASE_Y + 1));
    scene.add(root);
    const jar = new T.Group();
    root.add(jar);
    G.mesh(new T.BoxGeometry(0.86, 0.06, 0.86), G.std('#5a6273'), 0, 0.03, 0, root).receiveShadow = true;
    const chip = chipTexture();
    const cookieMat = G.std('#ffffff', { map: chip, roughness: 0.9 });
    const cookies = [];
    for (let i = 0; i < 4; i++) {
      const ck = G.mesh(new T.CylinderGeometry(0.19, 0.19, 0.07, 12), cookieMat, (i % 2 ? 0.05 : -0.04), 0.12 + i * 0.09, (i % 3) * 0.03 - 0.03, jar);
      ck.rotation.set(0.25 * (i % 2 ? 1 : -1), 0, 0.2 * (i % 3 - 1));
      cookies.push(ck);
    }
    const glass = new T.Mesh(new T.CylinderGeometry(0.29, 0.31, 0.5, 12, 1, true), new T.MeshStandardMaterial({
      color: '#d9f3ff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, side: T.DoubleSide, depthWrite: false,
    }));
    glass.position.y = 0.32;
    jar.add(glass);
    const lid = G.mesh(new T.CylinderGeometry(0.32, 0.32, 0.08, 12), G.std('#e53935', { roughness: 0.4 }), 0, 0.6, 0, jar);
    G.mesh(new T.BoxGeometry(0.12, 0.06, 0.12), G.std('#ff7b72'), 0, 0.07, 0, lid);
    const pole = G.mesh(new T.BoxGeometry(0.035, 0.62, 0.035), G.std('#f4f4f4'), 0.1, 0.95, 0, jar);
    const flag = new T.Mesh(new T.PlaneGeometry(0.42, 0.29, 8, 1), new T.MeshStandardMaterial({ map: flagTexture(), side: T.DoubleSide, roughness: 0.8 }));
    flag.position.set(0.1 + 0.21, 1.1, 0);
    flag.castShadow = true;
    jar.add(flag);
    const fp = flag.geometry.attributes.position, fx0 = Float32Array.from(fp.array);

    let lost = 0;
    function tick(t, dt) {
      for (let i = 0; i < fp.count; i++) {
        const x = fx0[i * 3];
        const k = (x + 0.21) / 0.42;
        fp.setZ(i, Math.sin(t * 6 - k * 3) * 0.05 * k);
        if (lost) fp.setY(i, fx0[i * 3 + 1] - k * 0.12 * Math.min(1, lost));
      }
      fp.needsUpdate = true;
      if (lost) {
        lost += dt;
        const k = Math.min(1, lost * 2.2);
        jar.rotation.z = k * 1.35;
        jar.position.x = k * 0.35;
        jar.position.y = Math.sin(k * Math.PI) * 0.2;
        lid.position.set(-k * 0.5, 0.6 + Math.sin(Math.min(1, lost * 1.5) * Math.PI) * 0.6, 0);
        cookies.forEach((ck, i) => { ck.visible = lost < 0.25 + i * 0.05; });
      }
    }
    function lose() { lost = 0.0001; }
    function reset() {
      lost = 0;
      jar.rotation.set(0, 0, 0);
      jar.position.set(0, 0, 0);
      lid.position.set(0, 0.6, 0);
      cookies.forEach((ck) => { ck.visible = true; });
    }
    return { root, tick, lose, reset, pole };
  }

  // ---------------------------------------------------------------- tanks

  const TANK_LOOKS = {
    teddy: { hull: '#3f86e8', dark: '#2a5fb5', stripe: '#e53935', turret: '#4a91f0' },
    tommy: { hull: '#7fdcbd', dark: '#3fae8b', stripe: '#f6eedc', turret: '#93e6ca' },
    zombie: { hull: '#8db05a', dark: '#5b7834', stripe: '#8a64b8', turret: '#9ec266' },
    robot: { hull: '#ff9636', dark: '#626877', stripe: '#5ef2ff', turret: '#ffab52' },
  };
  const ARMOR_COLORS = ['#ffffff', '#ffe066', '#ff9a3c', '#ff6fa8', '#8fd3ff']; // by hits left, for the flashing armored tank

  const DIMS = { player: [0.86, 0.88], basic: [0.84, 0.86], fast: [0.74, 0.92], power: [0.86, 0.86], armor: [0.94, 0.92] };

  function buildTank(kind, variant) {
    const look = TANK_LOOKS[kind] || TANK_LOOKS.zombie;
    const [W, L] = DIMS[variant] || DIMS.basic;
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const hullMat = G.std(look.hull, { roughness: 0.5 });
    const darkMat = G.std(look.dark, { roughness: 0.55 });
    const stripeMat = G.std(look.stripe, { roughness: 0.45 });
    const turretMat = G.std(look.turret, { roughness: 0.45 });
    const treadTop = tex.treadAcross.clone();
    treadTop.needsUpdate = true;
    treadTop.repeat.set(1, L * 3);
    const treadSide = tex.treadAlong.clone();
    treadSide.needsUpdate = true;
    treadSide.repeat.set(L * 3, 1);
    const tTop = G.std('#ffffff', { map: treadTop, roughness: 0.9 });
    const tSide = G.std('#ffffff', { map: treadSide, roughness: 0.9 });
    const tEnd = G.std('#2a2b31', { roughness: 0.9 });
    const tw = 0.2;
    for (const s of [-1, 1]) {
      G.mesh(new T.BoxGeometry(tw, 0.24, L), [tSide, tSide, tTop, tTop, tEnd, tEnd], s * (W / 2 - tw / 2), 0.12, 0, body);
      G.mesh(new T.BoxGeometry(tw + 0.04, 0.05, L + 0.03), darkMat, s * (W / 2 - tw / 2), 0.265, 0, body);
      G.mesh(new T.BoxGeometry(0.06, 0.052, L * 0.8), stripeMat, s * (W / 2 - tw / 2), 0.268, 0, body);
    }
    G.mesh(new T.BoxGeometry(W - 2 * tw + 0.04, 0.22, L - 0.12), hullMat, 0, 0.21, 0, body);
    G.mesh(new T.BoxGeometry(W - 2 * tw - 0.02, 0.05, 0.08), darkMat, 0, 0.27, L / 2 - 0.12, body); // engine grille
    const turret = new T.Group();
    turret.position.y = 0.32;
    body.add(turret);
    const ts = variant === 'fast' ? 0.38 : variant === 'power' ? 0.5 : variant === 'armor' ? 0.52 : 0.46;
    G.mesh(new T.BoxGeometry(ts, 0.18, ts), turretMat, 0, 0.09, 0.02, turret);
    G.mesh(new T.BoxGeometry(ts + 0.02, 0.04, 0.08), stripeMat, 0, 0.1, ts / 2 - 0.02, turret);
    G.mesh(new T.BoxGeometry(0.28, 0.03, 0.28), darkMat, 0, 0.19, 0.02, turret); // hatch ring
    const barrels = variant === 'power' ? [-0.075, 0.075] : [0];
    const bl = variant === 'power' ? 0.52 : variant === 'fast' ? 0.38 : 0.44;
    for (const bx of barrels) {
      G.mesh(new T.BoxGeometry(0.1, 0.1, bl), darkMat, bx, 0.09, -ts / 2 - bl / 2 + 0.06, turret);
      G.mesh(new T.BoxGeometry(0.14, 0.14, 0.08), darkMat, bx, 0.09, -ts / 2 - bl + 0.06, turret);
    }
    if (variant === 'fast') { // tail fins and a racing stripe
      for (const s of [-1, 1]) G.mesh(new T.BoxGeometry(0.04, 0.16, 0.18), stripeMat, s * 0.16, 0.36, L / 2 - 0.12, body);
      G.mesh(new T.BoxGeometry(0.1, 0.225, L - 0.1), stripeMat, 0, 0.212, 0, body);
    }
    if (variant === 'armor') { // bolted-on side plates
      for (const s of [-1, 1]) {
        G.mesh(new T.BoxGeometry(0.05, 0.2, L * 0.75), hullMat, s * (W / 2 + 0.02), 0.17, 0, body);
        for (const z of [-0.25, 0, 0.25]) G.mesh(new T.BoxGeometry(0.06, 0.05, 0.05), darkMat, s * (W / 2 + 0.035), 0.2, z, body);
      }
    }
    if (kind === 'robot') { // a blinking antenna light
      G.mesh(new T.BoxGeometry(0.03, 0.22, 0.03), darkMat, ts / 2 - 0.06, 0.29, ts / 2 - 0.04, turret);
      G.mesh(new T.BoxGeometry(0.07, 0.07, 0.07), new T.MeshBasicMaterial({ color: '#ff3d3d' }), ts / 2 - 0.06, 0.42, ts / 2 - 0.04, turret);
    }
    return {
      kind, variant, root, body, turret, hullMat, turretMat, darkMat, treadTop, treadSide, look,
      hatchY: 0.51, person: null, holder: null, shield: null, yaw: 0, inUse: true,
    };
  }

  // The driver popping out of the hatch: head and shoulders only, with a bigger head so you can tell who it is.
  function addDriver(tank, rosterId, s) {
    const entry = Kit.roster.get(rosterId);
    const p = Kit.people.build(entry.look);
    p.head.scale.setScalar(1.45);
    const holder = new T.Group();
    holder.position.y = tank.hatchY;
    tank.root.add(holder);
    holder.add(p.root);
    p.root.scale.setScalar(s);
    p.root.position.y = -1.08 * s;
    tank.person = p;
    tank.holder = holder;
    tank.ps = s;
    tank.rosterId = rosterId;
    return p;
  }

  function addShield(tank) {
    const g = new T.Group();
    const bubble = new T.Mesh(new T.SphereGeometry(0.66, 20, 14), new T.MeshBasicMaterial({
      color: '#8ff0ff', transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false,
    }));
    const cage = new T.Mesh(new T.IcosahedronGeometry(0.7, 1), new T.MeshBasicMaterial({
      color: '#c8fbff', wireframe: true, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false,
    }));
    g.add(bubble, cage);
    g.position.y = 0.36;
    g.visible = false;
    tank.root.add(g);
    tank.shield = g;
    tank.cage = cage;
    return g;
  }

  // A soft ring on the ground under the companion's tank, so you can tell he's the helper.
  function addHalo(tank, color) {
    const ring = new T.Mesh(new T.RingGeometry(0.52, 0.66, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    tank.root.add(ring);
    tank.halo = ring;
    return ring;
  }

  // ---------------------------------------------------------------- shells, power-ups

  function spriteOf(map, size, opts = {}) {
    const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map, depthWrite: false, transparent: true }, opts)));
    s.scale.set(size, size, 1);
    return s;
  }

  function shellView(kind) {
    const g = new T.Group();
    if (kind === 'ball') g.add(spriteOf(G.emojiTexture('🏀'), 0.42));
    else if (kind === 'peace') {
      const glow = spriteOf(tex.glow, 0.7, { color: '#ffe680', blending: T.AdditiveBlending });
      g.add(glow, spriteOf(G.emojiTexture('✌️'), 0.44));
    } else {
      const col = kind === 'zap' ? '#5ef2ff' : '#a6ff5e';
      g.add(spriteOf(tex.glow, 0.62, { color: col, blending: T.AdditiveBlending }), spriteOf(tex.dot, 0.24, { color: '#ffffff' }));
    }
    g.userData.spin = g.children[g.children.length - 1];
    return g;
  }

  function powerView(type) {
    const g = new T.Group();
    const glow = spriteOf(tex.glow, 1.5, { color: '#fff3a0', blending: T.AdditiveBlending, opacity: 0.6 });
    const badge = spriteOf(powerTexture(type), 0.86);
    g.add(glow, badge);
    g.userData.badge = badge;
    return g;
  }

  // ---------------------------------------------------------------- effects

  function makeFx(scene) {
    const pool = [];
    const live = [];
    function get(map) {
      let s = pool.pop();
      if (!s) {
        s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false }));
        s.renderOrder = 5;
      }
      s.material.map = map;
      s.material.color.set('#ffffff');
      s.material.opacity = 1;
      s.material.rotation = 0;
      s.material.blending = T.NormalBlending;
      s.material.depthTest = true;
      s.material.needsUpdate = true;
      s.visible = true;
      scene.add(s);
      return s;
    }
    // o: { map, x, y, z, vx, vy, vz, life, size, grow, spin, g (gravity), drag, color, additive, fade, onTop }
    function add(o) {
      const s = get(o.map);
      if (o.color) s.material.color.set(o.color);
      if (o.additive) s.material.blending = T.AdditiveBlending;
      if (o.onTop) s.material.depthTest = false;
      s.position.set(o.x, o.y || 0.5, o.z);
      const p = Object.assign({ s, vx: 0, vy: 0, vz: 0, life: 1, age: 0, size: 0.5, grow: 0, spin: 0, g: 0, drag: 0, fade: 0.4, rot: 0 }, o);
      p.rot = o.rot || 0;
      s.scale.set(p.size, p.size, 1);
      live.push(p);
      return p;
    }
    function update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.age += dt;
        if (p.age >= p.life) {
          p.s.visible = false;
          scene.remove(p.s);
          pool.push(p.s);
          live.splice(i, 1);
          continue;
        }
        p.vy -= p.g * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vz *= d;
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        p.s.position.z += p.vz * dt;
        if (p.bounce && p.s.position.y < 0.1) { p.s.position.y = 0.1; p.vy = Math.abs(p.vy) * 0.4; }
        const k = p.age / p.life;
        let sc = p.size + p.grow * p.age;
        if (p.pop) sc *= k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : k < 0.25 ? 1.15 - ((k - 0.15) / 0.1) * 0.15 : 1;
        p.s.scale.set(sc * (p.sx || 1), sc, 1);
        p.rot += p.spin * dt;
        p.s.material.rotation = p.rot;
        p.s.material.opacity = k > 1 - p.fade ? (1 - k) / p.fade : 1;
      }
    }
    function clear() {
      for (const p of live) { p.s.visible = false; scene.remove(p.s); pool.push(p.s); }
      live.length = 0;
    }

    const R = (a, b) => a + Math.random() * (b - a);
    const starTex = () => G.emojiTexture('⭐');

    // cartoon smoke puffs
    function puff(x, z, n = 6, color = '#ffffff', y = 0.4, spread = 1.4) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        add({ map: tex.dot, x, y, z, vx: Math.cos(a) * R(0.5, spread), vy: R(0.3, 1.2), vz: Math.sin(a) * R(0.5, spread), life: R(0.45, 0.8), size: R(0.35, 0.6), grow: 1.0, drag: 3, color, fade: 0.7 });
      }
    }
    function stars(x, z, n = 8, y = 0.5, speed = 3) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        add({ map: starTex(), x, y, z, vx: Math.cos(a) * R(1, speed), vy: R(2, 4.5), vz: Math.sin(a) * R(1, speed), g: 9, life: R(0.7, 1.1), size: R(0.25, 0.42), spin: R(-6, 6), drag: 1.2, fade: 0.4 });
      }
    }
    function word(x, z, text, fill, size = 1.1, y = 1.0) {
      add({ map: burstTexture(text, fill), x, y, z, vy: 0.6, life: 0.75, size, pop: true, fade: 0.35, onTop: true, rot: R(-0.25, 0.25) });
    }
    function points(x, z, n) {
      add({ map: textTexture('+' + n), x, y: 0.9, z, vy: 0.9, life: 1.0, size: 0.85, sx: 2.6, fade: 0.4, onTop: true }).s.scale.set(2.2, 0.85, 1);
    }
    function sparkle(x, z, y = 0.5, size = 1.2, life = 0.5) {
      add({ map: tex.sparkle, x, y, z, life, size, grow: -size * 1.4 / life, spin: 3, additive: true, fade: 0.5 });
    }
    function chunks(x, z, color, n = 6) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        add({ map: tex.dot, x: x + R(-0.15, 0.15), y: 0.35, z: z + R(-0.15, 0.15), vx: Math.cos(a) * R(0.4, 1.6), vy: R(1, 2.5), vz: Math.sin(a) * R(0.4, 1.6), g: 9, life: R(0.4, 0.7), size: R(0.1, 0.17), color, bounce: true, fade: 0.3 });
      }
    }
    function confetti(x, z, n = 30) {
      const cols = ['#ffd400', '#ff3d7f', '#18d4ff', '#7dff5a', '#ffffff', '#ff8a1f'];
      for (let i = 0; i < n; i++) {
        add({ map: tex.dot, x: x + R(-2.5, 2.5), y: R(2.5, 4), z: z + R(-1.5, 1.5), vx: R(-0.5, 0.5), vy: R(-0.2, 0.6), vz: R(-0.5, 0.5), g: 1.2, drag: 1.5, life: R(1.6, 2.6), size: R(0.12, 0.2), color: G.pick(cols), fade: 0.3, sx: 0.6 });
      }
    }
    function emoji(ch, x, z, o = {}) {
      return add(Object.assign({ map: G.emojiTexture(ch), x, y: 0.8, z, life: 1, size: 0.6, fade: 0.3 }, o));
    }
    return { add, update, clear, puff, stars, word, points, sparkle, chunks, confetti, emoji, live };
  }

  TT.art = {
    wx, hexShade, tex, initTextures, makeArena, makeBase, buildTank, addDriver, addShield, addHalo,
    shellView, powerView, powerTexture, powerIcon, miniTankCanvas, makeFx, spriteOf, burstTexture, TANK_LOOKS, ARMOR_COLORS,
  };
})();
