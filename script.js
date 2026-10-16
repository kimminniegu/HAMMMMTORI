(() => {
  const DESSERTS = [
    { e: '🍰', n: '케이크' },
    { e: '🧁', n: '컵케이크' },
    { e: '🍩', n: '도넛' },
    { e: '🍪', n: '쿠키' },
    { e: '🥐', n: '크루아상' },
    { e: '🍮', n: '푸딩' },
  ];
  const FUR = ['#f7d9b5', '#f3c9a0', '#fbe8d3', '#ead8c6', '#f6e3c9', '#e9e3ef', '#fde2c4'];
  const NAMES = ['콩이', '보리', '모찌', '두부', '밤톨', '호두', '땅콩', '쿠키', '설기', '찹쌀'];
  const HEARTS = ['💖', '💗', '💕', '💓', '❤️', '💞'];
  const CONFETTI = ['🎉', '✨', '⭐', '🌟', '💖', '🎀'];
  const TYPES = {
    normal: { pat: 1, mult: 1, tag: '' },
    vip:    { pat: 0.65, mult: 3, tag: '👑 ', fur: '#ffe08a' },
    sleepy: { pat: 1.5, mult: 1, tag: '💤 ', fur: '#e8e0fa' },
  };
  const MAX_LIVES = 3;
  const FEVER_TIME = 8;
  const MAX_PETS = 3;

  const $ = id => document.getElementById(id);
  const shopEl = $('shop'), slotsEl = $('slots'), trayEl = $('tray'), toastEl = $('toast');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 효과음 (Web Audio로 직접 합성) ---------- */
  const Sound = {
    ctx: null,
    muted: false,
    init() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(f, d = 0.12, { type = 'sine', vol = 0.14, to = null, delay = 0 } = {}) {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + d + 0.03);
    },
    seq(notes, step, opts) { notes.forEach((f, i) => this.tone(f, step * 1.8, { ...opts, delay: i * step })); },
  };
  const SFX = {
    toss:  () => Sound.tone(600, 0.1, { type: 'triangle', to: 1000, vol: 0.08 }),
    item:  () => Sound.seq([880, 1175], 0.06, { type: 'triangle' }),
    done:  () => Sound.seq([784, 988, 1175, 1568], 0.07, { type: 'triangle', vol: 0.12 }),
    vip:   () => Sound.seq([1047, 1319, 1568, 2093, 2637], 0.06, { type: 'triangle', vol: 0.12 }),
    miss:  () => Sound.tone(260, 0.22, { type: 'square', vol: 0.05, to: 160 }),
    sad:   () => Sound.seq([523, 440, 349], 0.15, { vol: 0.1 }),
    pet:   () => Sound.tone(1300, 0.09, { to: 1900, vol: 0.07 }),
    fever: () => Sound.seq([523, 659, 784, 1047, 1319, 1568, 2093], 0.05, { type: 'triangle', vol: 0.12 }),
    seed:  () => Sound.seq([1319, 1568, 2093], 0.05, { vol: 0.1 }),
    level: () => Sound.seq([659, 784, 988, 1319], 0.09, { type: 'triangle', vol: 0.12 }),
    enter: () => Sound.tone(900, 0.06, { to: 1250, vol: 0.035 }),
  };

  let best = 0;
  try {
    best = Number(localStorage.getItem('hamster-bakery-best')) || 0;
    Sound.muted = localStorage.getItem('hamster-bakery-muted') === '1';
  } catch (e) {}
  $('best').textContent = best;
  $('muteBtn').textContent = Sound.muted ? '🔇' : '🔊';
  $('muteBtn').addEventListener('click', () => {
    Sound.muted = !Sound.muted;
    $('muteBtn').textContent = Sound.muted ? '🔇' : '🔊';
    try { localStorage.setItem('hamster-bakery-muted', Sound.muted ? '1' : '0'); } catch (e) {}
    Sound.init();
  });

  const state = {
    running: false, gen: 0, score: 0, lives: MAX_LIVES, combo: 0, maxCombo: 0,
    served: 0, lv: 1, gauge: 0, fever: 0, seedCool: 0, slots: [], last: 0,
  };
  const level = () => 1 + Math.floor(state.served / 5);
  const later = (fn, ms) => { const g = state.gen; setTimeout(() => { if (g === state.gen) fn(); }, ms); };

  function hamsterSVG(fur) {
    return `
<svg viewBox="0 0 120 112" aria-hidden="true">
  <circle cx="28" cy="24" r="13" fill="${fur}"/>
  <circle cx="92" cy="24" r="13" fill="${fur}"/>
  <circle cx="28" cy="25" r="7" fill="#ffc4cf"/>
  <circle cx="92" cy="25" r="7" fill="#ffc4cf"/>
  <ellipse cx="60" cy="64" rx="52" ry="45" fill="${fur}"/>
  <ellipse cx="60" cy="78" rx="34" ry="29" fill="#fffaf2"/>
  <ellipse cx="60" cy="30" rx="10" ry="6" fill="#ffffff" opacity=".35"/>
  <g class="crown">
    <path d="M44 20 L47 5 L55 13 L60 1 L65 13 L73 5 L76 20 Z" fill="#ffd34d" stroke="#e9a93a" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="60" cy="14" r="2.6" fill="#ff8fb1"/>
  </g>
  <g class="eye">
    <circle cx="41" cy="58" r="5.5" fill="#4a3535"/>
    <circle cx="79" cy="58" r="5.5" fill="#4a3535"/>
    <circle cx="43" cy="56" r="1.8" fill="#fff"/>
    <circle cx="81" cy="56" r="1.8" fill="#fff"/>
  </g>
  <g class="eye-happy" fill="none" stroke="#4a3535" stroke-width="3" stroke-linecap="round">
    <path d="M35 60 Q41 52 47 60"/>
    <path d="M73 60 Q79 52 85 60"/>
  </g>
  <g class="eye-sleep" fill="none" stroke="#4a3535" stroke-width="3" stroke-linecap="round">
    <path d="M35 57 Q41 63 47 57"/>
    <path d="M73 57 Q79 63 85 57"/>
  </g>
  <ellipse cx="27" cy="72" rx="10" ry="6.5" fill="#ffb3c1" opacity=".8"/>
  <ellipse cx="93" cy="72" rx="10" ry="6.5" fill="#ffb3c1" opacity=".8"/>
  <ellipse cx="60" cy="67" rx="4.5" ry="3.2" fill="#e88a9a"/>
  <path d="M53 72 Q56.5 77 60 72 Q63.5 77 67 72" fill="none" stroke="#7a5555" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="45" cy="100" rx="9" ry="6" fill="${fur}" stroke="#00000010"/>
  <ellipse cx="75" cy="100" rx="9" ry="6" fill="${fur}" stroke="#00000010"/>
  <path class="tear" d="M86 62 q-4 7 0 9 q4 -2 0 -9z" fill="#9fd3ff"/>
</svg>`;
  }

  /* ---------- 트레이 ---------- */
  DESSERTS.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'item';
    b.innerHTML = `<kbd>${i + 1}</kbd><span class="emo">${d.e}</span><small>${d.n}</small>`;
    b.setAttribute('aria-label', `${d.n} 전달하기`);
    b.addEventListener('click', () => serve(b, d.e));
    trayEl.appendChild(b);
  });
  document.addEventListener('keydown', e => {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < DESSERTS.length) serve(trayEl.children[i], DESSERTS[i].e);
  });

  /* ---------- 손님 ---------- */
  function buildSlots() {
    slotsEl.innerHTML = '';
    const n = window.innerWidth < 560 ? 3 : 4;
    slotsEl.style.setProperty('--n', n);
    state.slots = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      slotsEl.appendChild(el);
      state.slots.push({ el, c: null, cool: rand(0.3, 1.5) + i * 0.7 });
    }
  }

  function pickType() {
    const r = Math.random();
    if (level() >= 2 && r < 0.13) return 'vip';
    if (r < 0.3) return 'sleepy';
    return 'normal';
  }

  function makeOrder() {
    const lv = level(), r = Math.random();
    let n = 1;
    if (lv >= 4 && r < 0.2) n = 3;
    else if (lv >= 2 && r < 0.45) n = 2;
    return Array.from({ length: n }, () => pick(DESSERTS).e);
  }

  function spawn(slot) {
    const type = pickType(), T = TYPES[type];
    const wants = makeOrder();
    const base = Math.max(5.5, 13 - level() * 0.8) + rand(-0.5, 1.5);
    const max = base * T.pat * (1 + 0.6 * (wants.length - 1));
    const name = pick(NAMES);
    const el = document.createElement('div');
    el.className = 'hamster ' + type;
    el.innerHTML = `
      <div class="bubble">
        <span class="who">${T.tag}${name}</span>
        <div class="wants n${wants.length}">${wants.map(w => `<span class="w">${w}</span>`).join('')}</div>
        <div class="bar"><i></i></div>
      </div>
      ${hamsterSVG(T.fur || pick(FUR))}`;
    slot.el.appendChild(el);
    const wEls = el.querySelectorAll('.w');
    const c = {
      type, name, el, max, t: max, pets: 0, busy: false, gone: false,
      bar: el.querySelector('.bar i'),
      wants: wants.map((e, i) => ({ e, st: 'need', el: wEls[i] })),
    };
    slot.c = c;
    el.querySelector('svg').addEventListener('click', () => pet(c));
    SFX.enter();
  }

  function leave(slot, delay) {
    const c = slot.c;
    later(() => {
      c.el.classList.add('leave');
      later(() => {
        c.el.remove();
        if (slot.c === c) {
          slot.c = null;
          slot.cool = rand(0.5, 2.0) / (1 + level() * 0.08);
        }
      }, 450);
    }, delay);
  }

  function pet(c) {
    if (!state.running || c.busy) return;
    c.el.classList.remove('pet');
    void c.el.offsetWidth;
    c.el.classList.add('pet');
    SFX.pet();
    const r = c.el.querySelector('svg').getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height * 0.4;
    if (c.pets < MAX_PETS) {
      c.pets++;
      c.t = Math.min(c.max, c.t + 0.9);
      burst(x, y, { n: 5, chars: ['💗', '💕'], dist: [25, 50], ring: false });
      floatText(x, r.top, c.pets === MAX_PETS ? '기분 최고! 💕' : '쓰담쓰담 ♡', 'small');
    } else {
      floatText(x, r.top, '빨리 디저트 주세요!', 'small');
    }
  }

  /* ---------- 메인 루프 ---------- */
  function loop(ts) {
    if (!state.running) return;
    const dt = state.last ? Math.min(0.1, (ts - state.last) / 1000) : 0;
    state.last = ts;

    if (state.fever > 0) {
      state.fever -= dt;
      state.gauge = Math.max(0, state.fever / FEVER_TIME * 100);
      if (state.fever <= 0) endFever();
      updateFeverBar();
    }

    for (const s of state.slots) {
      if (!s.c) {
        s.cool -= dt * (state.fever > 0 ? 2 : 1);
        if (s.cool <= 0) spawn(s);
        continue;
      }
      const c = s.c;
      if (c.busy) continue;
      if (state.fever <= 0) c.t -= dt;
      const p = Math.max(0, c.t / c.max);
      c.bar.style.width = (p * 100) + '%';
      c.bar.style.background = state.fever > 0 ? '#c9b8ff' : p > 0.5 ? '#9fdcb8' : p > 0.25 ? '#ffd98a' : '#ff9fb2';
      c.el.classList.toggle('hurry', p < 0.25 && state.fever <= 0);
      if (c.t <= 0) timeout(s);
    }

    state.seedCool -= dt;
    if (state.seedCool <= 0) {
      spawnSeed();
      state.seedCool = rand(11, 19);
    }

    requestAnimationFrame(loop);
  }

  function timeout(slot) {
    const c = slot.c;
    c.busy = true;
    c.gone = true;
    c.el.classList.remove('hurry');
    c.el.classList.add('sad');
    c.el.querySelector('.wants').innerHTML = '<span class="w">💧</span>';
    state.lives--;
    state.combo = 0;
    SFX.sad();
    updateHud();
    showToast(`${c.name}가 슬프게 돌아갔어요…`);
    leave(slot, 900);
    if (state.lives <= 0) later(gameOver, 700);
  }

  /* ---------- 디저트 전달 ---------- */
  function serve(btn, emoji) {
    if (!state.running) return;
    let target = null;
    for (const s of state.slots) {
      if (!s.c || s.c.busy) continue;
      const it = s.c.wants.find(w => w.st === 'need' && w.e === emoji);
      if (it && (!target || s.c.t < target.c.t)) target = { s, c: s.c, it };
    }
    if (!target) {
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
      shopEl.classList.remove('shake');
      void shopEl.offsetWidth;
      shopEl.classList.add('shake');
      state.combo = 0;
      if (state.fever <= 0) state.gauge = Math.max(0, state.gauge - 15);
      SFX.miss();
      updateHud();
      showToast('앗, 그건 아무도 안 찾아요! 🙈');
      return;
    }
    const { s, c, it } = target;
    it.st = 'flying';
    it.el.classList.add('sent');
    SFX.toss();
    flyTo(emoji, btn.querySelector('.emo').getBoundingClientRect(), it.el.getBoundingClientRect(), () => arrive(s, c, it));
  }

  function flyTo(emoji, from, to, done) {
    const f = document.createElement('div');
    f.className = 'fly';
    f.textContent = emoji;
    document.body.appendChild(f);
    const x0 = from.left + from.width / 2 - 26, y0 = from.top + from.height / 2 - 26;
    const x1 = to.left + to.width / 2 - 26, y1 = to.top + to.height / 2 - 26;
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 70;
    const anim = f.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1) rotate(0deg)` },
      { transform: `translate(${mx}px, ${my}px) scale(1.35) rotate(-20deg)`, offset: 0.5 },
      { transform: `translate(${x1}px, ${y1}px) scale(.9) rotate(0deg)` },
    ], { duration: 480, easing: 'ease-in-out' });
    let finished = false;
    const finish = () => { if (finished) return; finished = true; f.remove(); done(); };
    anim.onfinish = finish;
    setTimeout(finish, 520); // 탭이 백그라운드여서 애니메이션이 멈춰도 전달은 되도록
  }

  function arrive(slot, c, it) {
    if (!state.running || c.gone) return;
    it.st = 'done';
    it.el.classList.add('done');
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const mult = TYPES[c.type].mult * (state.fever > 0 ? 2 : 1);
    const pts = (5 + Math.min(state.combo - 1, 10)) * mult;
    state.score += pts;
    c.t = Math.min(c.max, c.t + 1.5);
    addFever(c.type === 'vip' ? 20 : 11);

    const ir = it.el.getBoundingClientRect();
    burst(ir.left + ir.width / 2, ir.top + ir.height / 2, { n: 6, dist: [25, 55], ring: false });

    if (c.wants.some(w => w.st !== 'done')) {
      SFX.item();
      floatText(ir.left + ir.width / 2, ir.top - 8, `+${pts}`, 'small');
      updateHud(true);
      return;
    }

    // 주문 완성!
    c.busy = true;
    state.served++;
    const pct = Math.max(0, c.t / c.max);
    const bonus = Math.round(8 + pct * 10) * c.wants.length * mult;
    state.score += bonus;
    updateHud(true);

    c.el.classList.add('happy');
    c.el.querySelector('.wants').innerHTML = '<span class="w">💕</span>';
    c.bar.style.width = '0%';

    const r = c.el.querySelector('svg').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.45;
    const big = c.type === 'vip' || state.fever > 0;
    burst(cx, cy, { n: big ? 26 : 16, dist: big ? [70, 150] : [55, 115], chars: c.type === 'vip' ? ['💛', '✨', '👑', '💖', '⭐'] : HEARTS });
    let label = `+${pts + bonus}`;
    if (state.combo > 1) label += `  ${state.combo}콤보!`;
    floatText(cx, r.top - 10, label, c.type === 'vip' ? 'gold' : '');
    (c.type === 'vip' ? SFX.vip : SFX.done)();
    leave(slot, 900);

    if (level() > state.lv) {
      state.lv = level();
      $('level').textContent = state.lv;
      later(() => {
        const sr = shopEl.getBoundingClientRect();
        banner(`LEVEL ${state.lv}!`, state.lv === 2 ? '👑 VIP 손님 & 2개 주문 등장!' : state.lv === 4 ? '3개 주문 손님 등장!' : '손님이 더 바빠져요!');
        burst(sr.left + sr.width / 2, sr.top + sr.height * 0.4, { n: 24, chars: CONFETTI, dist: [80, 200], ring: false });
        SFX.level();
      }, 350);
    }
  }

  /* ---------- 피버 타임 ---------- */
  function addFever(v) {
    if (state.fever > 0) return;
    state.gauge = Math.min(100, state.gauge + v + Math.min(state.combo, 10) * 0.6);
    updateFeverBar();
    if (state.gauge >= 100) startFever();
  }
  function startFever() {
    state.fever = FEVER_TIME;
    shopEl.classList.add('fever');
    $('hud').classList.add('fever-on');
    banner('FEVER TIME! 🌈', '점수 2배 · 시간 정지!');
    SFX.fever();
  }
  function endFever() {
    state.fever = 0;
    state.gauge = 0;
    shopEl.classList.remove('fever');
    $('hud').classList.remove('fever-on');
  }
  function updateFeverBar() { $('feverBar').style.width = state.gauge + '%'; }

  /* ---------- 해바라기씨 보너스 ---------- */
  function spawnSeed() {
    const b = document.createElement('button');
    b.className = 'seed';
    b.textContent = '🌻';
    b.setAttribute('aria-label', '해바라기씨 보너스');
    b.style.top = rand(50, 120) + 'px';
    shopEl.appendChild(b);
    const w = shopEl.clientWidth;
    const anim = b.animate([
      { transform: 'translate(-60px, 0) rotate(0deg)' },
      { transform: `translate(${w * 0.25}px, -20px) rotate(90deg)` },
      { transform: `translate(${w * 0.5}px, 0) rotate(180deg)` },
      { transform: `translate(${w * 0.75}px, -20px) rotate(270deg)` },
      { transform: `translate(${w + 60}px, 0) rotate(360deg)` },
    ], { duration: 6500, easing: 'linear' });
    anim.onfinish = () => b.remove();
    b.addEventListener('click', () => {
      if (!state.running) return;
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      anim.cancel();
      b.remove();
      SFX.seed();
      burst(x, y, { n: 12, chars: ['✨', '🌻', '⭐'], dist: [40, 90] });
      if (state.lives < MAX_LIVES) {
        state.lives++;
        floatText(x, y - 20, '+1 💗', 'gold');
      } else {
        state.score += 30;
        floatText(x, y - 20, '+30', 'gold');
      }
      updateHud(true);
    });
  }

  /* ---------- 이펙트 ---------- */
  function burst(x, y, { n = 16, chars = HEARTS, dist = [55, 115], ring = true } = {}) {
    if (ring) {
      const rg = document.createElement('div');
      rg.className = 'ring';
      rg.style.left = x + 'px';
      rg.style.top = y + 'px';
      document.body.appendChild(rg);
      rg.addEventListener('animationend', () => rg.remove());
    }
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = pick(chars);
      const ang = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const d = rand(dist[0], dist[1]);
      h.style.left = x + 'px';
      h.style.top = y + 'px';
      h.style.fontSize = rand(16, 30) + 'px';
      h.style.setProperty('--dx', Math.cos(ang) * d + 'px');
      h.style.setProperty('--dy', Math.sin(ang) * d - 20 + 'px');
      h.style.setProperty('--r', rand(-40, 40) + 'deg');
      h.style.setProperty('--dur', rand(0.7, 1.1) + 's');
      document.body.appendChild(h);
      h.addEventListener('animationend', () => h.remove());
    }
  }

  function floatText(x, y, text, cls = '') {
    const t = document.createElement('div');
    t.className = 'float-text ' + cls;
    t.textContent = text;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
    document.body.appendChild(t);
    t.addEventListener('animationend', () => t.remove());
  }

  // 배너가 겹치지 않도록 차례대로 띄움
  let bannerFreeAt = 0;
  function banner(title, sub) {
    const now = performance.now();
    const wait = Math.max(0, bannerFreeAt - now);
    bannerFreeAt = now + wait + 1500;
    later(() => {
      const b = document.createElement('div');
      b.className = 'banner';
      b.innerHTML = `<strong>${title}</strong>${sub ? `<span>${sub}</span>` : ''}`;
      shopEl.appendChild(b);
      b.addEventListener('animationend', () => b.remove());
    }, wait);
  }

  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1300);
  }

  function updateHud(bump) {
    const lives = Math.max(0, state.lives);
    $('score').textContent = state.score;
    $('combo').textContent = state.combo;
    $('lives').textContent = '💗'.repeat(lives) + '🤍'.repeat(MAX_LIVES - lives);
    $('level').textContent = state.lv;
    if (bump) {
      for (const id of ['scorePill', 'comboPill']) {
        const p = $(id);
        p.classList.remove('bump');
        void p.offsetWidth;
        p.classList.add('bump');
      }
    }
  }

  /* ---------- 시작 / 종료 ---------- */
  function clearShop() {
    shopEl.querySelectorAll('.seed, .banner').forEach(e => e.remove());
    bannerFreeAt = 0;
    endFever();
  }

  function start() {
    Sound.init();
    state.gen++;
    Object.assign(state, {
      running: true, score: 0, lives: MAX_LIVES, combo: 0, maxCombo: 0,
      served: 0, lv: 1, gauge: 0, fever: 0, seedCool: rand(8, 12), last: 0,
    });
    clearShop();
    buildSlots();
    updateHud();
    updateFeverBar();
    $('startOverlay').hidden = true;
    $('overOverlay').hidden = true;
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    clearShop();
    const newBest = state.score > best;
    if (newBest) {
      best = state.score;
      $('best').textContent = best;
      try { localStorage.setItem('hamster-bakery-best', String(best)); } catch (e) {}
    }
    $('overText').innerHTML =
      `햄찌 <b>${state.served}</b>마리 대접 · 최대 <b>${state.maxCombo}</b>콤보 · Lv <b>${state.lv}</b><br>` +
      `점수 <b>${state.score}</b>점` +
      (newBest ? '<br>🎉 최고 기록 달성! 🎉' : '');
    $('overOverlay').hidden = false;
    if (newBest) SFX.level();
  }

  $('startBtn').addEventListener('click', start);
  $('againBtn').addEventListener('click', start);
  buildSlots();
  updateHud();
})();
