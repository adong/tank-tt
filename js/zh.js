/* 中文 for Tank TT: the words on the page, the toasts, the map builder, the stage names and the ? panel (Kit.lang,
   from kit/lang.js). The comic word bursts drawn on canvases (POW!, BONK!...) go through Kit.lang.t() in js/art.js.
   The kids' names and the game's name and logo (TANK TT, the TT flag) stay in English on purpose. */
(function () {
  const L = Kit.lang;
  L.keep([
    'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY & TOMMY', 'TEDDY + TOMMY', 'TEDDY · 1P', 'TOMMY · 2P', 'Teddy (1P)', 'Tommy (2P)',
    'TANK', 'TT', 'TANK TT', 'Tank TT', 'Claude Code', 'Esc',
  ]);

  const STAGES = {
    BACKYARD: '后院', 'TOY BLOCKS': '积木城', 'DUCK POND': '鸭子池塘', 'BRICK TOWN': '砖头小镇', 'SNOW DAY': '下雪天',
    'DEEP FOREST': '大森林', 'STEEL CASTLE': '钢铁城堡', 'RIVER CROSSING': '过河', 'T FOR TEDDY & TOMMY': 'TEDDY 和 TOMMY 的 T',
    SMILEY: '笑脸', 'MAZE RUNNER': '迷宫', 'ICE RINK': '溜冰场', 'ROBOT FACTORY': '机器人工厂', 'ZOMBIE PARK': '僵尸公园',
    'COOKIE FORTRESS': '饼干堡垒', 'BIG FINALE': '大决战',
  };
  L.add(STAGES);

  L.add({
    // title screen
    'Guard the cookie jar from the zombie tanks!': '保护饼干罐，别让僵尸坦克抢走！',
    '1 player · key 1': '单人 · 按 1', '1 player · key 2': '单人 · 按 2', '2 players, one keyboard · key 3': '双人一起玩 · 按 3',
    BUILD: '搭地图', 'draw your own map · key B': '画你自己的地图 · 按 B',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', 'more tanks, slower zombies': '坦克更多，僵尸更慢', 'for big kids': '给大孩子', Difficulty: '难度',
    drive: '开坦克', fire: '开炮', 'easy ·': '简单 ·', stage: '选关',
    'faster, then 2 shots, then steel buster': '更快 → 一次两发 → 打穿钢墙', shield: '护盾', 'steel around the jar': '饼干罐围上钢墙',
    'freeze zombies': '冻住僵尸', 'all poof': '全部消失', 'extra tank': '多一辆坦克',
    "Thumb on the pad to drive, the big button to fire, and tap your brother's face to call him in. Two players can share an iPad: each gets a pad and a fire button.":
      '拇指按方向盘开坦克，按大按钮开炮，点兄弟的头像叫他来帮忙。两个人可以一起用一台 iPad：每人一个方向盘和一个开炮按钮。',
    'LOADING…': '加载中…',

    // the HUD
    'ZOMBIE TANKS': '僵尸坦克', 'ANOTHER TREAT?': '再来一个？', 'BROTHER POWER': '兄弟力量', 'he blocks one hit': '他能挡一次',
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', FIRE: '开炮',

    // the stage curtain, the celebration and the tally
    'YOUR OWN MAP!': '你自己的地图！', 'THE COOKIES ARE SAFE!': '饼干保住啦！', 'MAP CLEAR!': '地图过关！', 'ALL COOKIES SAFE!': '饼干全都保住啦！',
    BASIC: '小坦克', FAST: '快坦克', POWER: '大炮坦克', ARMOR: '铁甲坦克',
    'NEXT STAGE ▶': '下一关 ▶', '🏆 MENU': '🏆 菜单', '🛠️ BACK TO BUILD': '🛠️ 回去搭地图', 'Enter · Space next · Esc menu': '回车 · 空格 下一关 · Esc 菜单',

    // pause and game over
    '↻ RESTART STAGE': '↻ 重新开始这关', 'P · Esc · Space to resume · R restart · Q menu · M sound': 'P · Esc · 空格 继续 · R 重来 · Q 菜单 · M 声音',
    'OH NO!': '哎呀！', 'OUT OF TANKS!': '坦克用完啦！', '↻ TRY AGAIN': '↻ 再来一次', 'Enter try again · Esc menu': '回车 再来一次 · Esc 菜单',
    'The zombies got the cookies! Try again — call your brother to guard the jar.': '僵尸抢走了饼干！再来一次，叫兄弟来帮你守饼干罐。',

    // toasts while playing
    '⭐ FASTER SHOTS!': '⭐ 炮弹更快！', '⭐⭐ TWO SHOTS AT ONCE!': '⭐⭐ 一次两发！', '⭐⭐⭐ STEEL BUSTER!': '⭐⭐⭐ 能打穿钢墙！',
    '⭐ SUPER SHOTS!': '⭐ 超级炮弹！', '🪖 SHIELD ON!': '🪖 护盾打开！', '🧱 STEEL AROUND THE COOKIES!': '🧱 饼干罐围上钢墙！',
    '⏰ FREEZE!': '⏰ 冻住啦！', '💣 KABOOM! ALL POOF!': '💣 轰！全都消失！', '+1 TANK!': '+1 坦克！', 'BROTHER POWER! 🛡️': '兄弟力量！🛡️',

    // comic bursts drawn on the 3D scene (js/art.js asks for them through Kit.lang.t)
    'POW!': '砰！', 'POOF!': '噗！', 'BAM!': '嘭！', 'POP!': '啵！', 'CLANG!': '铛！', 'BONK!': '咚！',
    'BOING!': '嘣！', 'BOINK!': '咚～', 'PING!': '叮！', 'SAVED!': '救下啦！',

    // 🛠️ the map builder
    '🛠️ BUILD': '🛠️ 搭地图', BRICK: '砖墙', STEEL: '钢墙', WATER: '水', TREES: '树林', ICE: '冰面', ERASE: '擦掉', BOTH: '一起',
    'Draw walls, then press PLAY!': '画好墙，再按开始！', '✅ Ready! Press PLAY to drive it.': '✅ 好啦！按开始去开坦克。',
    '🔧 FIX IT': '🔧 修好', '🎲 SURPRISE': '🎲 惊喜', '🗑️ CLEAR': '🗑️ 清空', '🗑️ SURE? TAP AGAIN': '🗑️ 确定？再点一下', '◀ MENU': '◀ 菜单',

    // the ? panel (js/keys.js)
    'fire (hold to keep firing)': '开炮（按住连发）', 'title: Teddy · Tommy · both · build': '标题页：Teddy · Tommy · 双人 · 搭地图',
    'Playing alone, both sets of keys drive your tank.': '一个人玩时，两套按键都能开你的坦克。',
    "The pad (bottom left), the big 🏀 / ✌️ fire button (bottom right) and your brother's face above it.":
      '方向盘在左下角，大大的 🏀 / ✌️ 开炮按钮在右下角，兄弟的头像在它上面。',
  });

  const WHO = '(TEDDY|TOMMY)';
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const SIDE = { left: '左边', middle: '中间', right: '右边' };
  const problem = (p) => {
    let m = /^The (left|middle|right) zombie gate can't reach the cookie jar$/.exec(p);
    if (m) return `${SIDE[m[1]]}的僵尸大门到不了饼干罐`;
    m = /^(Teddy|Tommy)'s start can't reach the (left|middle|right) gate$/.exec(p);
    if (m) return `${m[1]} 的出发点到不了${SIDE[m[2]]}的大门`;
    return p;
  };

  L.rule(/^STAGE (\d+)( ⭐)?$/, '第 $1 关$2');
  L.rule(/^STAGE (\d+) CLEAR!$/, '第 $1 关过关！');
  L.rule(/^MY MAP (\d)$/, '我的地图 $1');
  L.rule(new RegExp(`^CALL ${WHO}$`), '叫 $1');
  L.rule(new RegExp(`^${WHO}!$`), '$1！');
  L.rule(new RegExp(`^HERE COMES ${WHO}!$`), '$1 来啦！');
  L.rule(new RegExp(`^${WHO} SAVED THE COOKIES!$`), '$1 保住了饼干！');
  L.rule(new RegExp(`^${WHO} SAVED YOU!$`), '$1 救了你！');
  L.rule(new RegExp(`^${WHO} GOT BONKED! BACK IN A SEC…$`), '$1 被打中啦！马上回来…');
  L.rule(new RegExp(`^${WHO} IS OUT OF TANKS!$`), '$1 没有坦克了！');
  L.rule(new RegExp(`^\\+1 TANK FOR ${WHO}!$`), '$1 多一辆坦克！');
  L.rule(new RegExp(`^(\\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM ${WHO}!$`), (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(\d+) zombie tanks? went POOF!(?: Next: (.+))?$/, (m, n, next) => `${n} 辆僵尸坦克变没啦！${next ? `下一关：${STAGES[next] || next}` : ''}`);
  L.rule(/^You beat all (\d+) stages! Teddy and Tommy are the cookie champions!$/, '$1 关全部通过！Teddy 和 Tommy 是饼干冠军！');
  L.rule(/^So close! (\d+) zombie tanks left\. Try again — a 🪖 or ⭐ helps a lot\.$/, '差一点点！还剩 $1 辆僵尸坦克。再来一次，🪖 和 ⭐ 很有用哦。');
  L.rule(/^⚠️ (.+)\. Leave a gap, or tap FIX IT\.$/, (m, p) => `⚠️ ${problem(p)}。留个缺口，或者点“修好”。`);

  // bursts already drawn on the board are cached per language, so a switch just draws new ones; nothing to rebuild
})();
