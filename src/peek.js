'use strict';

// ボードの左右から、赤いモンスター(と、その左右反転)が、ゆったり顔を出す。
//  ・同時に出るのは1匹だけ
//  ・出るたびに、左右どちらから出るか・高さ・大きさ・傾き・向き(左右反転)・隠れ方が変わる
//  ・隠れ方は3種類のミックス:「顔だけちょこっと」「半分くらい」「ほぼ全身」
//  ・1回の登場は 7〜11秒、引っこんでから次に出るまで 2〜5秒
(function () {
  const layer = document.getElementById('peekLayer');
  if (!layer) return;

  const IMAGE = 'img/mon-red.png';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---- 設定(ここを変えると、調整できる) ----
  const SIZE = [28, 36];           // 大きさ(ボードの横幅に対する %)
  const STAY_MS = [7000, 11000];   // 1回の登場の長さ
  const WAIT_MS = [2000, 5000];    // 引っこんでから、次に出るまで
  const FIRST_MS = 800;            // 最初に出るまで
  // 隠れ方(体のうち、ボードの後ろに隠れる割合)。出るたびに、どれかをランダムに選ぶ
  const HIDE_TIERS = [
    [0.55, 0.85],   // 顔だけちょこっと
    [0.15, 0.45],   // 半分くらい
    [0.0, 0.2],     // ほぼ全身
  ];
  const MIN_VISIBLE = 0.25;        // 横の余白が足りないときでも、体の25%は見せる

  const el = document.createElement('div');
  el.className = 'peek';
  el.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = IMAGE;
  img.alt = '';
  img.draggable = false;
  el.appendChild(img);
  layer.appendChild(el);

  // 動きを減らす設定のときは、動かさずに、1匹だけ置く
  if (reduceMotion) {
    el.style.visibility = 'visible';
    el.style.top = '48%';
    el.style.width = '30%';
    el.style.left = '-20%';
    el.style.transform = 'rotate(-10deg)';
    return;
  }

  let current = null;   // いま動いているアニメーション
  let lastSides = [];   // 直近の左右(同じ側が3回続かないようにする)
  let lastTop = null;

  function pickSide() {
    let side = Math.random() < 0.5 ? 'left' : 'right';
    const n = lastSides.length;
    if (n >= 2 && lastSides[n - 1] === lastSides[n - 2] && side === lastSides[n - 1]) side = side === 'left' ? 'right' : 'left';
    lastSides.push(side);
    if (lastSides.length > 4) lastSides.shift();
    return side;
  }

  function appear() {
    const rect = layer.getBoundingClientRect();
    const side = pickSide();
    const left = side === 'left';

    const w = rand(SIZE[0], SIZE[1]);                       // 大きさ(ボード幅の %)
    const tier = HIDE_TIERS[Math.floor(Math.random() * HIDE_TIERS.length)];
    let visibleFrac = 1 - rand(tier[0], tier[1]);           // ボードの外に出ている体の割合

    // ウィンドウの横の余白に収まるようにする(切れないように、出る量を減らす)
    const room = left ? rect.left : window.innerWidth - rect.right;
    const needPx = rect.width * (w / 100) * visibleFrac;
    if (needPx > room - 10) visibleFrac = Math.max(MIN_VISIBLE, (room - 10) / (rect.width * (w / 100)));

    // 高さ:体がボードの上下からはみ出さない範囲で選び、前回と近すぎないようにする
    const topMax = Math.max(2, 98 - w * 1.05);
    let top = rand(2, topMax);
    for (let k = 0; k < 8 && lastTop != null && Math.abs(top - lastTop) < 18; k++) top = rand(2, topMax);
    lastTop = top;

    const flip = Math.random() < 0.5;                        // 左右反転するか
    const tilt = (left ? -1 : 1) * rand(6, 14);              // ボードの方へ少し傾く

    el.style.top = top + '%';
    el.style.width = w + '%';
    el.style.left = left ? -(w * visibleFrac) + '%' : 'auto';
    el.style.right = left ? 'auto' : -(w * visibleFrac) + '%';
    el.style.transformOrigin = left ? '100% 60%' : '0% 60%';
    img.style.transform = flip ? 'scaleX(-1)' : 'none';
    el.style.visibility = 'visible';                         // 出ている間だけ表示する

    const away = left ? 92 : -92;                            // 引っこんだとき、ボードの後ろへすっかり隠れる向き
    const hidden = `translateX(${away}%) rotate(${tilt * 0.35}deg)`;
    const at = (k) => `translateX(0) rotate(${tilt * k}deg)`;
    const frames = [
      { transform: hidden, offset: 0 },
      { transform: at(1), offset: 0.12 },        // ひょっこり出る
      { transform: at(0.75), offset: 0.26 },     // ゆったりゆれる
      { transform: at(1.15), offset: 0.42 },
      { transform: at(0.85), offset: 0.6 },
      { transform: at(1.05), offset: 0.8 },
      { transform: hidden, offset: 1 },          // すっと引っこむ
    ];
    const duration = rand(STAY_MS[0], STAY_MS[1]);
    if (current) current.cancel();               // 前のアニメーションは片づける
    current = el.animate(frames, { duration, easing: 'ease-in-out', fill: 'both' });
    // 終わりは、アニメーションの「終了の知らせ」ではなく、タイマーで決める。
    // (ウィンドウが隠れている間は、終了の知らせが届かず、次の登場が止まってしまうことがあるため)
    setTimeout(() => {
      el.style.visibility = 'hidden';            // 待っている間は、完全に見えなくする
      setTimeout(appear, rand(WAIT_MS[0], WAIT_MS[1]));
    }, duration);
  }

  setTimeout(appear, FIRST_MS);
})();
