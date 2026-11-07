'use strict';

// ===== データ構造 =====
// state = { version, currentBoardId, boards: [ board ] }
// board = { id, name, size, createdAt, archived, archivedAt, cells: [ cell ] }   cells は size*size 個
// cell  = { title, due, memo, stamped }     due は 'YYYY-MM-DD' または ''

const $ = (id) => document.getElementById(id);

let state = { version: 1, currentBoardId: null, boards: [] };
let view = 'board'; // 'board'(ボード画面) か 'history'(履歴画面)。保存はしない
let editingIndex = null; // いま編集中のマスの番号
let lastStampedIndex = null; // 直前にスタンプしたマス(ポンッのアニメ用)

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const emptyCell = () => ({ title: '', due: '', memo: '', stamped: false });

function currentBoard() {
  return state.boards.find((b) => b.id === state.currentBoardId) || null;
}
const isReadonly = (board) => !!(board && board.archived);

// ===== ビンゴ判定 =====
// 縦・横・斜めのうち、全マスにスタンプが押されているラインを返す。
function getCompleteLines(board) {
  const n = board.size;
  const lines = [];
  const add = (key, idxs) => lines.push({ key, cells: idxs });
  for (let r = 0; r < n; r++) add('r' + r, Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) add('c' + c, Array.from({ length: n }, (_, r) => r * n + c));
  add('d1', Array.from({ length: n }, (_, i) => i * n + i));
  add('d2', Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  return lines.filter((l) => l.cells.every((i) => board.cells[i].stamped));
}
const isAllStamped = (board) => board.cells.every((c) => c.stamped);

// ===== 締切 =====
// 戻り値: { text, level } level = 'overdue'(過ぎた) | 'soon'(2日以内) | 'normal'
function dueInfo(cell) {
  if (!cell.due) return null;
  const [y, m, d] = cell.due.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((new Date(y, m - 1, d) - today) / 86400000);
  const md = `${m}/${d}`;
  if (cell.stamped) return { text: md, level: 'normal' }; // 完了したマスは警告しない
  if (diff < 0) return { text: `期限切れ ${md}`, level: 'overdue' };
  if (diff === 0) return { text: '今日まで', level: 'soon' };
  if (diff <= 2) return { text: `あと${diff}日`, level: 'soon' };
  return { text: md, level: 'normal' };
}

// ===== 保存(変更のたびに自動で呼ぶ。少し待ってまとめて書く) =====
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    let ok = false;
    try { ok = (await window.store.save(state)) !== false; } catch { ok = false; }
    $('saveWarn').classList.toggle('hidden', ok);
  }, 150);
}

// ===== 確認ダイアログ =====
function confirmAsk(title, message, okLabel) {
  $('confirmTitle').textContent = title;
  $('confirmMessage').textContent = message;
  $('confirmOk').textContent = okLabel;
  const dlg = $('confirmDialog');
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// ===== 描画 =====
function render() {
  const board = currentBoard();
  const active = state.boards.filter((b) => !b.archived);

  // 画面の切り替え
  const showHistory = view === 'history';
  $('historyArea').classList.toggle('hidden', !showHistory);
  $('boardArea').classList.toggle('hidden', showHistory || !board);
  $('emptyState').classList.toggle('hidden', showHistory || !!board);
  $('historyBtn').textContent = showHistory ? '← ボードへ' : '履歴';

  // ボード選択プルダウン(進行中のボードだけ。履歴を見ているときは先頭に目印を出す)
  const sel = $('boardSelect');
  sel.replaceChildren();
  if (isReadonly(board) && !showHistory) {
    const o = document.createElement('option');
    o.value = board.id;
    o.textContent = `(履歴)${board.name}`;
    sel.appendChild(o);
  }
  for (const b of active) {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.name}(${b.size}×${b.size})`;
    sel.appendChild(opt);
  }
  sel.value = board ? board.id : '';
  sel.disabled = sel.options.length === 0;

  if (showHistory) { renderHistory(); return; }
  if (!board) return;

  const ro = isReadonly(board);
  $('readonlyNote').classList.toggle('hidden', !ro);
  $('renameBtn').classList.toggle('hidden', ro);
  $('archiveBtn').classList.toggle('hidden', ro);
  $('unarchiveBtn').classList.toggle('hidden', !ro);

  const done = board.cells.filter((c) => c.stamped).length;
  $('progress').textContent = `完了 ${done} / ${board.cells.length}`;

  // ビンゴのライン(揃っている間はずっと光らせる。崩れたら自然に消える)
  const lines = getCompleteLines(board);
  const inLine = new Set(lines.flatMap((l) => l.cells));
  const countEl = $('bingoCount');
  countEl.classList.toggle('hidden', lines.length === 0);
  countEl.textContent = `${lines.length} BINGO!`;

  const grid = $('grid');
  grid.className = `grid size-${board.size}`;
  grid.replaceChildren();
  board.cells.forEach((cell, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isEmpty = cell.title.trim() === '';
    const due = isEmpty ? null : dueInfo(cell);
    btn.className = 'cell'
      + (isEmpty ? ' empty-cell' : '')
      + (cell.stamped ? ' stamped' : '')
      + (inLine.has(i) ? ' bingo' : '')
      + (due ? ' has-due due-' + due.level : '');
    btn.setAttribute('aria-label', isEmpty ? `空のマス ${i + 1}` : `${cell.title}${cell.stamped ? '(完了)' : ''}${due ? '、締切 ' + due.text : ''}`);

    if (!isEmpty) {
      // マウスを乗せると全文・締切・メモが見える
      const tip = [cell.title];
      if (cell.due) tip.push(`締切: ${cell.due}`);
      if (cell.memo.trim()) tip.push(`メモ: ${cell.memo.trim()}`);
      btn.title = tip.join('\n');

      const t = document.createElement('span');
      t.className = 'cell-title';
      t.textContent = cell.title;
      btn.appendChild(t);

      if (due) {
        const d = document.createElement('span');
        d.className = 'due-badge ' + due.level;
        d.textContent = due.text;
        btn.appendChild(d);
      }
      if (cell.memo.trim()) {
        const m = document.createElement('span');
        m.className = 'memo-mark';
        m.textContent = '✎';
        btn.appendChild(m);
      }
    }
    if (cell.stamped) btn.appendChild(buildStamp(i, i === lastStampedIndex));
    // 空のマスは履歴では開かない
    if (!(ro && isEmpty)) btn.addEventListener('click', () => openCellDialog(i));
    grid.appendChild(btn);
  });
  lastStampedIndex = null;
}

// ===== スタンプ(モンスターが「できた!」と顔を出す) =====
// どのモンスターか・傾きはマスの番号から決めるので、描き直しても同じ見た目になる
const MONSTERS = [
  { name: 'blue',   color: '#2ea7f2' },
  { name: 'yellow', color: '#ffd51f' },
  { name: 'teal',   color: '#4fd1b0' },
  { name: 'red',    color: '#ff6b6b' },
  { name: 'purple', color: '#b08be0' },
  { name: 'green',  color: '#a8d447' },
];
function buildStamp(index, pop) {
  const mon = MONSTERS[index % MONSTERS.length];
  const rot = ((index * 37) % 17) - 8; // -8°〜+8°
  const wrap = document.createElement('span');
  wrap.className = 'stamp' + (pop ? ' pop' : '');
  wrap.style.setProperty('--rot', rot + 'deg');
  wrap.style.setProperty('--stamp', mon.color);

  const img = document.createElement('img');
  img.src = `img/mon-${mon.name}.png`;
  img.alt = '';
  img.draggable = false;
  const pill = document.createElement('span');
  pill.className = 'done-pill';
  pill.textContent = 'DONE!';
  wrap.append(img, pill);
  return wrap;
}

// ===== 履歴画面 =====
function renderHistory() {
  const list = $('historyList');
  list.replaceChildren();
  // 履歴 = アーカイブしたボード + すべて完了したボード
  const items = state.boards
    .filter((b) => b.archived || isAllStamped(b))
    .sort((a, b) => (b.archivedAt || b.createdAt).localeCompare(a.archivedAt || a.createdAt));

  if (items.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-history';
    p.textContent = 'まだ履歴はありません。ボードを全部完了するか、アーカイブするとここに残ります。';
    list.appendChild(p);
    return;
  }
  for (const b of items) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'hist-card';

    const name = document.createElement('div');
    name.className = 'hist-name';
    name.textContent = b.name;

    const done = b.cells.filter((c) => c.stamped).length;
    const meta = document.createElement('div');
    meta.className = 'hist-meta';
    const date = (b.archivedAt || b.createdAt).slice(0, 10).replace(/-/g, '/');
    meta.textContent = `${b.size}×${b.size} ・ 完了 ${done}/${b.cells.length} ・ ${getCompleteLines(b).length} BINGO ・ ${date}`;

    const chips = document.createElement('div');
    chips.className = 'hist-chips';
    if (isAllStamped(b)) chips.appendChild(chip('全マス制覇', 'full'));
    chips.appendChild(b.archived ? chip('アーカイブ済み', 'arch') : chip('進行中のボードにも表示', 'live'));

    card.append(name, meta, chips);
    card.addEventListener('click', () => {
      state.currentBoardId = b.id;
      view = 'board';
      save();
      render();
    });
    list.appendChild(card);
  }
}
function chip(text, cls) {
  const s = document.createElement('span');
  s.className = 'chip ' + cls;
  s.textContent = text;
  return s;
}

$('historyBtn').addEventListener('click', () => {
  view = view === 'history' ? 'board' : 'history';
  render();
});

// ===== ボード作成 =====
function openNewBoardDialog() {
  $('newBoardName').value = '';
  document.querySelector('input[name="size"][value="3"]').checked = true;
  $('newBoardDialog').showModal();
  $('newBoardName').focus();
}

$('newBoardBtn').addEventListener('click', openNewBoardDialog);
$('emptyNewBtn').addEventListener('click', openNewBoardDialog);
$('newBoardCancel').addEventListener('click', () => $('newBoardDialog').close());
$('newBoardForm').addEventListener('submit', () => {
  const size = Number(document.querySelector('input[name="size"]:checked').value);
  const name = $('newBoardName').value.trim() || `ボード${state.boards.length + 1}`;
  const board = {
    id: newId(),
    name,
    size,
    createdAt: new Date().toISOString(),
    archived: false,
    archivedAt: null,
    cells: Array.from({ length: size * size }, emptyCell),
  };
  state.boards.push(board);
  state.currentBoardId = board.id;
  view = 'board';
  save();
  render();
});

$('boardSelect').addEventListener('change', (e) => {
  state.currentBoardId = e.target.value;
  save();
  render();
});

// ===== ボードの管理(名前変更・アーカイブ・削除) =====
$('renameBtn').addEventListener('click', () => {
  $('renameInput').value = currentBoard().name;
  $('renameDialog').showModal();
  $('renameInput').select();
});
$('renameCancel').addEventListener('click', () => $('renameDialog').close());
$('renameForm').addEventListener('submit', () => {
  const name = $('renameInput').value.trim();
  if (name) currentBoard().name = name;
  save();
  render();
});

function pickNextActiveBoard(exceptId) {
  const next = state.boards.find((b) => !b.archived && b.id !== exceptId);
  state.currentBoardId = next ? next.id : null;
}

$('archiveBtn').addEventListener('click', async () => {
  const board = currentBoard();
  const ok = await confirmAsk('アーカイブする?', `「${board.name}」を履歴に移します。履歴からは閲覧だけできて、「進行中に戻す」でいつでも戻せます。`, 'アーカイブ');
  if (!ok) return;
  board.archived = true;
  board.archivedAt = new Date().toISOString();
  pickNextActiveBoard(board.id);
  save();
  render();
});

$('unarchiveBtn').addEventListener('click', () => {
  const board = currentBoard();
  board.archived = false;
  board.archivedAt = null;
  save();
  render();
});

$('deleteBtn').addEventListener('click', async () => {
  const board = currentBoard();
  const ok = await confirmAsk('ボードを削除する?', `「${board.name}」を完全に削除します。元に戻せません。残しておきたいときは「アーカイブ」を使ってね。`, '削除する');
  if (!ok) return;
  state.boards = state.boards.filter((b) => b.id !== board.id);
  pickNextActiveBoard(board.id);
  save();
  render();
});

// ===== マス編集 =====
function openCellDialog(index) {
  const board = currentBoard();
  const cell = board.cells[index];
  const ro = isReadonly(board);
  editingIndex = index;
  $('cellTitle').value = cell.title;
  $('cellDue').value = cell.due;
  $('cellMemo').value = cell.memo;

  // 履歴(アーカイブ済み)のときは閲覧専用にする
  for (const id of ['cellTitle', 'cellDue', 'cellMemo']) $(id).disabled = ro;
  $('cellSave').classList.toggle('hidden', ro);
  $('stampBtn').classList.toggle('hidden', ro);
  $('cellDialogTitle').textContent = ro ? 'マスの内容(閲覧のみ)' : 'マスの編集';
  $('cellCancel').textContent = ro ? '閉じる' : 'キャンセル';

  updateStampButton();
  $('cellDialog').showModal();
  if (!ro) $('cellTitle').focus();
}

// タイトルが空ならスタンプ不可
function updateStampButton() {
  const cell = currentBoard().cells[editingIndex];
  const hasTitle = $('cellTitle').value.trim() !== '';
  const btn = $('stampBtn');
  btn.disabled = !hasTitle;
  btn.textContent = cell.stamped ? 'スタンプを取り消す' : 'スタンプを押す';
  btn.classList.toggle('is-on', cell.stamped);
  btn.title = hasTitle ? '' : 'タイトルを書くとスタンプを押せます';
}
$('cellTitle').addEventListener('input', updateStampButton);

// フォームの内容をマスに反映
function applyForm() {
  const cell = currentBoard().cells[editingIndex];
  cell.title = $('cellTitle').value.trim();
  cell.due = $('cellDue').value;
  cell.memo = $('cellMemo').value;
  if (cell.title === '') cell.stamped = false; // 空のマスはスタンプ無し
}

$('cellForm').addEventListener('submit', () => {
  if (isReadonly(currentBoard())) return;
  applyForm();
  save();
  render();
});
$('cellCancel').addEventListener('click', () => $('cellDialog').close());

$('stampBtn').addEventListener('click', () => {
  const board = currentBoard();
  if (isReadonly(board)) return;
  applyForm();
  const cell = board.cells[editingIndex];
  if (cell.title === '') return;

  const before = new Set(getCompleteLines(board).map((l) => l.key));
  cell.stamped = !cell.stamped;
  if (cell.stamped) lastStampedIndex = editingIndex;
  save();
  $('cellDialog').close();
  render();

  // スタンプを「押した」ときだけ、新しく揃ったラインがあればお祝い(取り消しでは出さない)
  if (cell.stamped) {
    const after = getCompleteLines(board);
    const gotNew = after.some((l) => !before.has(l.key));
    if (isAllStamped(board)) setTimeout(() => window.celebrate('full', after.length), 380);
    else if (gotNew) setTimeout(() => window.celebrate('bingo', after.length), 380);
  }
});

// 日付をまたいだあとにアプリへ戻ったとき、締切の表示を更新する
window.addEventListener('focus', () => { if (!$('cellDialog').open) render(); });

// ===== バックアップ(書き出し / 読み込み) =====
const BACKUP_NOTE = {
  web: 'データは、いま使っているこのブラウザの中にだけ保存されています(サーバーには送られません)。ブラウザの「閲覧データの削除」や、別のブラウザ・別の端末では見えません。大事なデータは、ときどき書き出しておくと安心です。',
  desktop: 'データは、このパソコンの中にだけ保存されています(外には送られません)。別のパソコンに移したいときなどに使えます。',
};
function setBackupMsg(text, isError) {
  const el = $('backupMsg');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

$('exportBtn').addEventListener('click', () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const name = `masudone-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  setBackupMsg(`「${name}」を書き出しました(ダウンロードフォルダなどに保存されます)。`, false);
});

// 読み込んだファイルが、このアプリのデータとして正しいか調べて、足りない項目をおぎなう
function normalizeBackup(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.boards)) throw new Error('このアプリのバックアップファイルではないようです。');
  const boards = data.boards.map((b, bi) => {
    const size = Number(b && b.size);
    if (!b || (size !== 3 && size !== 5)) throw new Error(`${bi + 1}個目のボードの大きさが正しくありません。`);
    if (!Array.isArray(b.cells) || b.cells.length !== size * size) throw new Error(`${bi + 1}個目のボードのマスの数が正しくありません。`);
    return {
      id: typeof b.id === 'string' && b.id ? b.id : newId(),
      name: String(b.name ?? '').slice(0, 30) || `ボード${bi + 1}`,
      size,
      createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date().toISOString(),
      archived: !!b.archived,
      archivedAt: b.archived ? (typeof b.archivedAt === 'string' ? b.archivedAt : new Date().toISOString()) : null,
      cells: b.cells.map((c) => ({
        title: String((c && c.title) ?? '').slice(0, 60),
        due: /^\d{4}-\d{2}-\d{2}$/.test(String((c && c.due) ?? '')) ? c.due : '',
        memo: String((c && c.memo) ?? ''),
        stamped: !!(c && c.stamped) && String((c && c.title) ?? '').trim() !== '',
      })),
    };
  });
  const ids = new Set();
  for (const b of boards) { while (ids.has(b.id)) b.id = newId(); ids.add(b.id); }
  return { version: 1, currentBoardId: typeof data.currentBoardId === 'string' ? data.currentBoardId : null, boards };
}

$('importBtn').addEventListener('click', () => { $('importFile').value = ''; $('importFile').click(); });
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const next = normalizeBackup(JSON.parse(text));
    const ok = await confirmAsk(
      'バックアップを読み込む?',
      `いまのデータ(ボード ${state.boards.length} 個)は、「${file.name}」の内容(ボード ${next.boards.length} 個)に置き換わります。元に戻せないので、いまのデータを残したいときは、先に「書き出す」をしてね。`,
      '読み込む'
    );
    if (!ok) { setBackupMsg('読み込みをやめました。', false); return; }
    state = next;
    if (!currentBoard() || currentBoard().archived) {
      const first = state.boards.find((b) => !b.archived);
      state.currentBoardId = first ? first.id : null;
    }
    save();
    setBackupMsg(`読み込みました(ボード ${state.boards.length} 個)。`, false);
    render();
  } catch (err) {
    setBackupMsg('読み込めませんでした:' + (err && err.message ? err.message : String(err)), true);
  }
});

// ===== 起動 =====
(async function init() {
  $('backupNote').textContent = BACKUP_NOTE[window.storeKind] || BACKUP_NOTE.web;
  const loaded = await window.store.load();
  if (loaded && Array.isArray(loaded.boards)) state = loaded;
  if (!currentBoard() || currentBoard().archived) {
    const next = state.boards.find((b) => !b.archived);
    state.currentBoardId = next ? next.id : null;
  }
  render();
})();
