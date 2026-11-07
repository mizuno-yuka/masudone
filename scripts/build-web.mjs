// Web版の公開用フォルダ(docs/)を作る。
// src/ の中身を docs/ にコピーする(デスクトップ版専用の main.js と preload.js は除く)。
// 使い方:  npm run build:web
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const out = path.join(root, 'docs');
const skip = new Set(['main.js', 'preload.js']);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let count = 0;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (from === src && skip.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else { fs.copyFileSync(a, b); count++; }
  }
}
copyDir(src, out);
// GitHub Pages が余計な変換をしないようにする目印
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`docs/ を作りました(${count} ファイル)`);
