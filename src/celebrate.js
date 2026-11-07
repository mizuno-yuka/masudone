'use strict';

// お祝い演出(紙吹雪 + バナー)。window.celebrate(kind, count) で呼ぶ。
//   kind = 'bingo' : ラインが揃ったとき
//   kind = 'full'  : 全マス制覇(より豪華)
(function () {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  const banner = document.getElementById('banner');
  const COLORS = ['#ffd23f', '#4aa3e8', '#2f9e6b', '#ff8fa3', '#e2483d', '#fffaf0'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = [];
  let running = false;
  let bannerTimer = null;
  const timers = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);

  // (x, y) から n 個の紙吹雪を放射状に打ち上げる
  function burst(x, y, n, power, spread = Math.PI * 2, angle = -Math.PI / 2) {
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const v = rand(power * 0.4, power);
      particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        w: rand(6, 12), h: rand(4, 8),
        rot: rand(0, Math.PI * 2), vr: rand(-0.3, 0.3),
        color: COLORS[(Math.random() * COLORS.length) | 0],
        star: Math.random() < 0.15,
        life: 0, max: rand(110, 190),
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function drawStar(r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function tick() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles = particles.filter((p) => p.life < p.max && p.y < window.innerHeight + 40);
    for (const p of particles) {
      p.life++;
      p.vy += 0.22;        // 重力
      p.vx *= 0.985;       // 空気抵抗
      p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, (p.max - p.life) / 30);
      ctx.fillStyle = p.color;
      if (p.star) drawStar(p.w);
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (particles.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  function showBanner(main, sub, kind, ms) {
    clearTimeout(bannerTimer);
    document.getElementById('bannerMain').textContent = main;
    document.getElementById('bannerSub').textContent = sub || '';
    banner.className = 'banner ' + kind;
    // アニメーションを最初からやり直す
    void banner.offsetWidth;
    banner.classList.add('show');
    bannerTimer = setTimeout(() => {
      banner.classList.remove('show');
      banner.classList.add('hidden');
    }, ms);
  }

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  // モンスターが画面の下からぴょこっと出てきて、ジャンプして、また帰っていく
  const MONSTERS = ['blue', 'yellow', 'teal', 'red', 'purple', 'green'];
  function spawnActor(name, leftPct, widthPx, delay, jumps, totalMs) {
    const img = new Image();
    img.src = `img/mon-${name}.png`;
    img.alt = '';
    img.draggable = false;
    img.className = 'actor';
    img.style.left = `calc(${leftPct}% - ${widthPx / 2}px)`;
    img.style.width = `${widthPx}px`;
    document.body.appendChild(img);

    // 出る → ジャンプ(jumps 回) → 少し止まる → 帰る
    const up = 0.14, down = 0.86;
    const frames = [{ transform: 'translateY(115%) rotate(0deg)', offset: 0 }, { transform: 'translateY(0) rotate(0deg)', offset: up }];
    const span = (down - up - 0.06) / jumps;
    for (let j = 0; j < jumps; j++) {
      const t0 = up + span * j, tilt = j % 2 ? 7 : -7;
      frames.push({ transform: `translateY(-${rand(50, 90)}px) rotate(${tilt}deg) scale(1.04, .98)`, offset: t0 + span * 0.45 });
      frames.push({ transform: 'translateY(0) rotate(0deg) scale(1.06, .92)', offset: t0 + span * 0.8 });
      frames.push({ transform: 'translateY(0) rotate(0deg)', offset: t0 + span });
    }
    frames.push({ transform: 'translateY(0) rotate(0deg)', offset: down });
    frames.push({ transform: 'translateY(115%) rotate(0deg)', offset: 1 });
    const anim = img.animate(frames, { duration: totalMs, delay, fill: 'both', easing: 'ease-in-out' });
    anim.onfinish = () => img.remove();
  }
  function shuffle(a) { return a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]); }

  window.celebrate = function (kind, count) {
    const W = window.innerWidth, H = window.innerHeight;
    timers.splice(0).forEach(clearTimeout);

    if (kind === 'full') {
      showBanner('COMPLETE!', '全マス制覇！おめでとう！', 'full', 4200);
      if (reduceMotion) return;
      // 6匹そろって登場。全員でジャンプ!
      MONSTERS.forEach((m, i) => spawnActor(m, 9 + i * 16.4, Math.min(170, W / 7), i * 90, 5, 4800));
      // 左右の下から斜めに、中央から上に、何度も打ち上げる
      for (let i = 0; i < 8; i++) {
        later(() => {
          burst(0, H, 70, 22, Math.PI / 3, -Math.PI / 3);
          burst(W, H, 70, 22, Math.PI / 3, (-Math.PI * 2) / 3);
          burst(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.5), 60, 12);
        }, i * 420);
      }
    } else {
      showBanner(`${count} BINGO!`, 'ラインが揃ったよ！', 'bingo', 2200);
      if (reduceMotion) return;
      // ランダムに3匹がお祝いに来る
      shuffle(MONSTERS).slice(0, 3).forEach((m, i) => spawnActor(m, 18 + i * 32, Math.min(150, W / 6), i * 120, 2, 2600));
      burst(W / 2, H * 0.45, 110, 16);
      later(() => burst(W * 0.25, H * 0.5, 50, 12), 200);
      later(() => burst(W * 0.75, H * 0.5, 50, 12), 320);
    }
  };
})();
