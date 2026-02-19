const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
    setup() {
        // --- 変数定義 ---
        const mode = ref('setup'); 
        const items = ref([]);
        const currentScope = ref('domestic');
        const stayDays = ref(1);
        const newItemName = ref('');
        const processing = ref(false);
        const shareUrl = ref('');
        const statusMsg = ref('');
        const showTerms = ref(false);
        const copyStatus = ref(false);
        
        // 入力欄へのフォーカス用
        const addInput = ref(null);

        // SortableJSのインスタンス保持用
        let sortableInstance = null;

        // --- 初期化 ---
        onMounted(async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const id = urlParams.get('id');
            if (id) await loadSharedList(id);
        });

        const copyToClipboard = async () => {
            try {
                // クリップボードに書き込み
                await navigator.clipboard.writeText(shareUrl.value);
                
                // ボタンの見た目を「完了！」に変える
                copyStatus.value = true;
                
                // 2秒後に元に戻す
                setTimeout(() => {
                    copyStatus.value = false;
                }, 2000);
            } catch (err) {
                alert('コピーに失敗しました');
            }
        };
        // --- ★ ドラッグ機能の有効化関数 ---
        const initSortable = async () => {
            await nextTick(); // 画面描画待ち

            const el = document.getElementById('sort-list');
            if (!el) return;

            // 多重起動防止
            if (sortableInstance) sortableInstance.destroy();

            sortableInstance = new Sortable(el, {
                handle: '.drag-handle', // つまみクラス
                animation: 150,         // アニメーション速度
                ghostClass: 'sortable-ghost', // ドラッグ中の影
                
                // ★ドラッグ終了時にデータ配列も並び替える
                onEnd: (evt) => {
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;
                    // 配列の中身を移動
                    const movedItem = items.value.splice(oldIndex, 1)[0];
                    items.value.splice(newIndex, 0, movedItem);
                }
            });
        };

        // --- 機能関数 ---

        // 1. おすすめリスト生成
        const generateList = async () => {
            try {
                const res = await fetch(`api.php?scope=${currentScope.value}`);
                const data = await res.json();
                
                items.value = data.map(i => {
                    let name = i.item_name;
                    const days = parseInt(stayDays.value);

                    if (['着替え', '下着', '靴下'].includes(name)) {
                        name = `${name} (${days + 1}日分)`;
                    } else if (name === 'コンタクトレンズ') {
                        name = `${name} (${days + 1}セット)`;
                    }

                    if (currentScope.value === 'overseas') {
                        if (name === 'パスポート') name = '🔥パスポート (有効期限チェック！)';
                        if (name === '変換プラグ') name = '🔌変換プラグ (行き先の型を確認)';
                        if (name === '現地通貨(現金)') name = days >= 4 ? '💵現地通貨 (チップ用に小銭多め)' : '💵現地通貨 (最小限でOK)';
                        if (name === 'クレジットカード(予備含む2枚以上)') name = '💳カード (VISAとMasterなど別ブランドで)';
                    }
                    return { item_name: name, checked: false };
                });
                
                mode.value = 'list';
                initSortable();
            } catch (e) {
                alert("データ取得に失敗しました");
            }
        };

        // 2. 0から作成
        const createEmptyList = async () => {
            items.value = [];
            mode.value = 'list';
            await initSortable();
            // 入力欄にフォーカス
            if (addInput.value) addInput.value.focus();
        };

        // 3. アイテム追加
        const addItem = () => {
            if (!newItemName.value.trim()) return;
            // リストの先頭に追加
            items.value.unshift({ item_name: newItemName.value, checked: false });
            newItemName.value = '';
        };

        // 4. アイテム削除
        const removeItem = (index) => {
            items.value.splice(index, 1);
        };

        // 5. 保存処理（順番通りに配列を送信）
        const saveList = async () => {
            processing.value = true;
            try {
                const res = await fetch('save.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scope: currentScope.value,
                        stay_days: stayDays.value,
                        items: items.value
                    })
                });
                const result = await res.json();
                shareUrl.value = window.location.origin + window.location.pathname + '?id=' + result.share_id;
            } catch (e) { alert("保存できませんでした"); }
            finally { processing.value = false; }
        };

        // 6. 読み込み処理
        const loadSharedList = async (id) => {
            try {
                const res = await fetch(`api.php?id=${id}`);
                const data = await res.json();
                if (data.error) throw new Error();
                
                items.value = data.items; // DBからORDER BY順で返ってくる前提
                currentScope.value = data.info.scope;
                stayDays.value = data.info.stay_days;
                mode.value = 'view';
                initSortable();
            } catch (e) {
                alert("リストの読み込みに失敗しました");
                resetToSetup();
            }
        };

        // 7. 更新処理
        const updateList = async () => {
            const id = new URLSearchParams(window.location.search).get('id');
            processing.value = true;
            statusMsg.value = '';
            try {
                await fetch('update.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ share_id: id, items: items.value })
                });
                statusMsg.value = '保存しました！';
                setTimeout(() => statusMsg.value = '', 3000);
            } catch (e) { alert("更新に失敗しました"); }
            finally { processing.value = false; }
        };

        const resetToSetup = () => window.location.href = window.location.pathname;

        return { 
            mode, items, currentScope, stayDays, newItemName, 
            processing, shareUrl, statusMsg, showTerms, addInput,
            generateList, createEmptyList, addItem, removeItem, saveList, updateList, resetToSetup,
            copyStatus, copyToClipboard
        };
    }
}).mount('#app');