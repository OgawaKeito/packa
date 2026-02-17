<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// --- データベース接続設定 ---
require_once 'db_config.php';


try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // URLの ?id= を取得
    $id = isset($_GET['id']) ? $_GET['id'] : null;

    if ($id) {
        // --- モード1：保存済みデータの読み込み ---
        
        // 1. 基本情報の取得（国内/海外、日数）
        $stmtInfo = $pdo->prepare("SELECT scope, stay_days FROM shared_lists WHERE share_id = ?");
        $stmtInfo->execute([$id]);
        $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);

        if (!$info) {
            echo json_encode(['error' => '指定されたリストが見つかりません。']);
            exit;
        }

        // 2. アイテム一覧とチェック状態の取得
        $stmtItems = $pdo->prepare("SELECT item_name, is_checked as checked FROM list_items WHERE share_id = ?");
        $stmtItems->execute([$id]);
        $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

        // Vueが扱いやすいように型を調整して返す
        echo json_encode([
            'info' => $info,
            'items' => array_map(function($i) {
                $i['checked'] = (bool)$i['checked']; // 0,1をtrue,falseに変換
                return $i;
            }, $items)
        ]);

    } else {
        // --- モード2：新規作成用のマスタデータ取得 ---
        
        $scope = isset($_GET['scope']) ? $_GET['scope'] : 'common';
        
        // 選択されたスコープ（国内or海外）＋共通アイテムを取得
        $sql = "SELECT item_name FROM items_master WHERE scope = :scope OR scope = 'common' ORDER BY id ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['scope' => $scope]);
        
        $master_items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($master_items);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました。']);
}