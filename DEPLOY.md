# 公開手順（Packa）

サイトを、ロリポップへ公開（または更新）するまでの手順です。
アップロードには、`FTPforLollipop`（FTPSでアップロードするPowerShellスクリプト）を使います。

- 公開URL: https://packa.ogawa.jp.net/ （正規のアドレス。http は、ここへ転送される）
- サーバー上の場所: 親フォルダ `web/`（別サイトの公開フォルダ）の下の `packa/`
- 公開用ファイルの置き場: `FTPforLollipop` と同じ階層の `packa-deploy\`（`site\` と `config.json`）

## サーバーの構成と、注意点

- `web/` の中は、親フォルダの別サイトのドメインからも URL で届く。`.htaccess` が、正規のホスト名以外を 404 にして塞いでいる。
- 親フォルダの `.htaccess`（別サイト）の設定は、このサイトにも継承される。CSS/JS/画像の「1 年・immutable」は、このサイトの `.htaccess` で上書きしている。
- **本番の DB の接続情報は、リポジトリに入れない。** サーバーにだけ置くファイル:
- `db_config.php`: db_config.sample.php をコピーして値を書き換える（変数は $host, $db, $user, $pass）。

## 全体の流れ

1. 変更をコミットする
2. 公開用フォルダを作る（`deploy/build-deploy.js`）
3. ドライランで送信対象を確認する
4. アップロードする（パスワードは本人が入力）
5. 公開後の確認をする

> パスワードは、本人が入力します。Claude には入力させません。

## 1. コミットする

公開用フォルダは、**コミット済みのファイルだけ**から作ります。

```powershell
git status -sb
git log --oneline -3
```

## 2. 公開用フォルダを作る

| モード | コマンド | 使いどき |
|---|---|---|
| 通常公開 | `node deploy/build-deploy.js --live` | 通常どおり公開するとき |
| メンテナンス | `node deploy/build-deploy.js --maintenance` | 公開はするが、全ページを503にしたいとき |

- README、LICENSE、`deploy/` などは含めない。設定ファイルが混ざっていれば、エラーで止まる。
- 置き場所は、サーバーの `/packa`（`--remote` で変更できる）。
- アップロード用の設定 `packa-deploy/config.json` を作る（接続先は `FTPforLollipop/config.json` から引き継ぐ）。

## 3. ドライランで確認する

```powershell
$env:LOLLIPOP_FTP_PASSWORD = 'dry-run-only'   # ダミー。このウィンドウ内だけ
Set-Location <FTPforLollipopのフォルダ>
.\Upload-Lollipop.ps1 -Config <packa-deployのフォルダ>\config.json -DryRun
Remove-Item Env:\LOLLIPOP_FTP_PASSWORD
```

送信先が `/packa` 以下になっていること、設定ファイルが含まれていないことを確認する。

## 4. アップロードする

```powershell
Set-Location <FTPforLollipopのフォルダ>
.\Upload-Lollipop.ps1 -Config <packa-deployのフォルダ>\config.json
```

- 最後に `失敗 0` と出れば成功。
- **サーバー上のファイルは削除されない。** 追加・上書きだけ。
- **`.htaccess` は上書きされる。** サーバー上に既存の内容があれば、先に控えを取って見比べる。

## 5. 公開後の確認

```bash
for u in / /nothing /.git/config /README.md; do printf "%s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "https://packa.ogawa.jp.net$u"; done
```

| 確認 | 期待する結果 |
|---|---|
| `https://packa.ogawa.jp.net/` | 200 |
| `/nothing`、`/.git/config`、`/README.md` | 404 |
| `http://packa.ogawa.jp.net/` | `https://packa.ogawa.jp.net/` へ 301 |
| 親のドメイン経由（`https://andmballetstudio.daa.jp/packa/`） | 404 |
| `curl -I https://packa.ogawa.jp.net/css/style.css`（CSS がある場合） | `Cache-Control: public, max-age=86400`（`immutable` が付いていない） |
| 存在しない URL | このサイトの 404 ページ |

設定ファイル（DB の接続情報）は、次のように、外から取得できないことも確認する（どれも 404 または 403）。

- `https://packa.ogawa.jp.net/db_config.php`

## メンテナンスの入れ方・解除の仕方

- **入れる:** `node deploy/build-deploy.js --maintenance` → ドライラン → アップロード
- **解除する:** `node deploy/build-deploy.js --live` → ドライラン → アップロード
- 手動の場合は、`.htaccess` の「メンテナンスモード」の 4 行の先頭の `#` を外す（解除は付ける）。
