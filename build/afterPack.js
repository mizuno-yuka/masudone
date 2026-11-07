// ビルド時に、アプリ本体(MasuDone.exe)へアイコンを埋め込む
const path = require('path');
const { rcedit } = require('rcedit');

exports.default = async function afterPack(context) {
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  await rcedit(exe, {
    icon: path.join(context.packager.projectDir, 'build', 'icon.ico'),
    'version-string': {
      ProductName: 'MasuDone!',
      FileDescription: 'MasuDone!',
    },
  });
};
