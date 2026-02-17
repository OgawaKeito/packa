<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');


// --- データベース接続設定 ---
require_once 'db_config.php';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Vue.jsから送信されたJSONデータを取得
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if (!$data) {
        throw new Exception("データが届いていません。");
    }

    // 1. ユニークな共有ID（UUID）を生成 (8文字)
    $share_id = bin2hex(random_bytes(4));

    // トランザクション開始（親と子の不整合を防ぐ）
    $pdo->beginTransaction();

    // 2. shared_lists テーブルに旅程の基本情報を保存
    $stmt1 = $pdo->prepare("INSERT INTO shared_lists (share_id, stay_days, scope) VALUES (?, ?, ?)");
    $stmt1->execute([
        $share_id,
        $data['stay_days'],
        $data['scope']
    ]);

    // 3. list_items テーブルに各アイテムのチェック状態を保存
    $stmt2 = $pdo->prepare("INSERT INTO list_items (share_id, item_name, is_checked) VALUES (?, ?, ?)");
    
    foreach ($data['items'] as $item) {
        $stmt2->execute([
            $share_id,
            $item['item_name'],
            $item['checked'] ? 1 : 0
        ]);
    }

    // すべて成功したら確定
    $pdo->commit();

    // 生成したIDをフロントエンドに返す
    echo json_encode([
        'status' => 'success',
        'share_id' => $share_id
    ]);

} catch (Exception $e) {
    // 途中で失敗したらやり直す
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}