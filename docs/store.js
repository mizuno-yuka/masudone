'use strict';

// データの保存の仕組み。
//  ・デスクトップ版(Electron):preload.js が window.store を用意する(PC内のファイルに保存)
//  ・Web版(ブラウザ):ここで localStorage を使う版を用意する(そのブラウザの中にだけ保存)
// app.js は、どちらでも同じように window.store.load() / save() を呼ぶだけでよい。
(function () {
  if (window.store) {
    window.storeKind = 'desktop';
    return;
  }
  window.storeKind = 'web';

  const KEY = 'masudone:data:v1';
  window.store = {
    async load() {
      try {
        const text = localStorage.getItem(KEY);
        return text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('読み込みに失敗:', e);
        return null;
      }
    },
    async save(data) {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        // 容量オーバーや、プライベートモードで保存が禁止されているとき
        console.error('保存に失敗:', e);
        return false;
      }
    },
  };

  // ブラウザに「このデータは消さないで」とお願いする(対応していないブラウザでは何もしない)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* 何もしない */ }

  // オフラインでも動き、ホーム画面に追加できるようにする(https または localhost のときだけ)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('オフライン対応の登録に失敗:', e));
    });
  }
})();
