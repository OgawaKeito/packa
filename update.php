<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');


require_once 'db_config.php';


try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Vue.jsから送信されたJSONデータを取得
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if (!$data || !isset($data['share_id'])) {
        throw new Exception("更新対象のIDが指定されていません。");
    }

    $share_id = $data['share_id'];

    // トランザクション開始
    $pdo->beginTransaction();

    // 1. 既存のアイテム詳細を一旦削除（上書きの準備）
    $stmtDel = $pdo->prepare("DELETE FROM list_items WHERE share_id = ?");
    $stmtDel->execute([$share_id]);

    // 2. 最新のアイテムリストをインサート
    $stmtIns = $pdo->prepare("INSERT INTO list_items (share_id, item_name, is_checked, sort_order) VALUES (?, ?, ?, ?)");

    foreach ($data['items'] as $index => $item) {
        $stmtIns->execute([
            $share_id,
            $item['item_name'],
            $item['checked'] ? 1 : 0,
            $index // 並び順を保存
        ]);
    }

    // すべて成功したら確定
    $pdo->commit();

    echo json_encode(['status' => 'success']);

} catch (Exception $e) {
    // エラー時はロールバック
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}