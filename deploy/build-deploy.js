#!/usr/bin/env node
// 公開用フォルダを、コミット済みのファイルだけから作る(Packa)。
//
//   node deploy/build-deploy.js --live          # 通常公開用
//   node deploy/build-deploy.js --maintenance   # 全ページを 503(メンテナンス中)にして公開
//
// オプション:
//   --out <dir>     出力先 (既定: FTPforLollipop と同じ階層の packa-deploy/site)
//   --ftp <dir>     FTPforLollipop のフォルダ (既定: 上の階層から探す)
//   --remote <dir>  サーバー側の置き場 (既定: /packa ← 親フォルダ web/ の下のサイトのフォルダ)
//
// 注意: 作業ツリーの未コミットの変更は含まれない。必ずコミットしてから実行すること。

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXCLUDE = ["README.md","LICENSE","DEPLOY.md",".gitignore","deploy","db_config.sample.php"];
const REQUIRED = [".htaccess","index.html","api.php","save.php","update.php"];
const FORBIDDEN = new RegExp("db_config(\\.sample)?\\.php$|\\.md$|(^|/)deploy/");
const MAINTENANCE_LINES = 4;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const mode = flag('--maintenance') ? 'maintenance' : flag('--live') ? 'live' : null;
if (!mode) {
  console.error('--live か --maintenance を指定してください。');
  process.exit(2);
}

const repo = path.resolve(__dirname, '..');

function findFtp() {
  let dir = repo;
  for (let i = 0; i < 6; i++) {
    const c = path.join(dir, 'FTPforLollipop');
    if (fs.existsSync(path.join(c, 'config.json'))) return c;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
const ftp = path.resolve(opt('--ftp', findFtp() || ''));
if (!fs.existsSync(path.join(ftp, 'config.json'))) {
  console.error('FTPforLollipop/config.json が見つかりません。--ftp で指定してください。');
  process.exit(2);
}
const out = path.resolve(opt('--out', path.join(path.dirname(ftp), 'packa-deploy', 'site')));
const remote = opt('--remote', '/packa');

const dirty = execSync('git status --porcelain', { cwd: repo }).toString().trim();
if (dirty) console.warn('警告: 未コミットの変更があります。公開用フォルダには含まれません。\n' + dirty + '\n');

const head = execSync('git log --oneline -1', { cwd: repo }).toString().trim();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const outForShell = out.split(path.sep).join('/');
execSync(`git archive HEAD | tar -x -C "${outForShell}"`, { cwd: repo, shell: 'bash', stdio: 'inherit' });

for (const p of EXCLUDE) fs.rmSync(path.join(out, p), { recursive: true, force: true });

// メンテナンスモード: .htaccess の 4 行のコメントを外す
if (mode === 'maintenance') {
  const f = path.join(out, '.htaccess');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const i = lines.findIndex((l) => l.includes('メンテナンスモード'));
  if (i < 0) throw new Error('.htaccess にメンテナンスモードのブロックがありません');
  let n = 0;
  for (let k = i; k < i + 8; k++) {
    if (/^\s*# (RewriteCond|RewriteRule)/.test(lines[k])) { lines[k] = lines[k].replace('# ', ''); n++; }
  }
  if (n !== MAINTENANCE_LINES) throw new Error('メンテナンス用の行が ' + MAINTENANCE_LINES + ' 行見つかりません: ' + n);
  fs.writeFileSync(f, lines.join('\n'));
}

// 出力の点検: 置いてはいけないものが入っていないこと
const all = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else all.push(path.relative(out, p).split(path.sep).join('/'));
  }
})(out);
const forbidden = all.filter((f) => FORBIDDEN.test(f));
if (forbidden.length) throw new Error('公開用フォルダに入ってはいけないファイルがあります:\n' + forbidden.join('\n'));
for (const need of REQUIRED) {
  if (!all.includes(need)) throw new Error('必要なファイルが入っていません: ' + need);
}

const base = JSON.parse(fs.readFileSync(path.join(ftp, 'config.json'), 'utf8'));
base.localPath = path.relative(ftp, out).split(path.sep).join('/');
base.remotePath = remote;
const cfgPath = path.join(path.dirname(out), 'config.json');
fs.writeFileSync(cfgPath, JSON.stringify(base, null, 2));

console.log(`モード   : ${mode === 'maintenance' ? 'メンテナンス(503)' : '通常公開'}`);
console.log(`元       : ${head}`);
console.log(`出力先   : ${out} (${all.length}ファイル)`);
console.log(`置き場所 : サーバーの ${remote}`);
console.log(`設定     : ${cfgPath}`);
console.log('');
console.log('サーバー側にだけ置くファイル(公開用フォルダには入らない。デプロイでは上書きも削除もされない):');
console.log('  db_config.php');
