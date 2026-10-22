<?php
// 設定ファイルの見本。
//
// 1. このファイルを db_config.php という名前でコピーし、値を書き換える。
// 2. db_config.php は git に入れない(.gitignore に入っている)。実際のパスワードは、リポジトリに書かない。
// 3. 本番のサーバーには、db_config.php を手でアップロードする(デプロイの対象外。上書きもされない)。
//    外から取得できないよう、.htaccess が拒否している。

$host = 'localhost';   // ロリポップでは、「データベース」画面に出ているホスト名
$db   = 'CHANGE_ME';
$user = 'CHANGE_ME';
$pass = 'CHANGE_ME';
