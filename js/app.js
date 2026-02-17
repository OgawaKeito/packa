const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const mode = ref('setup'); 
        const items = ref([]);
        const currentScope = ref('domestic');
        const stayDays = ref(1);
        const newItemName = ref('');
        const processing = ref(false);
        const shareUrl = ref('');
        const statusMsg = ref('');
        const showTerms = ref(false);
        // URLにIDがあれば閲覧モードへ
        onMounted(async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const id = urlParams.get('id');
            if (id) await loadSharedList(id);
        });

        // マスタから取得（宿泊数に応じた計算付き）
        const generateList = async () => {
            try {
                const res = await fetch(`api.php?scope=${currentScope.value}`);
                const data = await res.json();
                
                items.value = data.map(i => {
                    let name = i.item_name;
                    const days = parseInt(stayDays.value);

                    // --- 宿泊数に応じた数量計算ロジック ---
                    if (['着替え', '下着', '靴下'].includes(name)) {
                        name = `${name} (${days + 1}日分)`;
                    } else if (name === 'コンタクトレンズ') {
                        name = `${name} (${days + 1}セット)`;
                    }

                    // --- 海外旅行(overseas)専用の最適化ヒント ---
                    if (currentScope.value === 'overseas') {
                        if (name === 'パスポート') name = '🔥パスポート (有効期限チェック！)';
                        if (name === '変換プラグ') name = '🔌変換プラグ (行き先の型を確認)';
                        if (name === '現地通貨(現金)') {
                            name = days >= 4 ? '💵現地通貨 (チップ用に小銭多め)' : '💵現地通貨 (最小限でOK)';
                        }
                        if (name === 'クレジットカード(予備含む2枚以上)') {
                            name = '💳カード (VISAとMasterなど別ブランドで)';
                        }
                    }

                    return { item_name: name, checked: false };
                });
                
                mode.value = 'list';
            } catch (e) {
                alert("データ取得に失敗しました");
            }
        };

        // リストに自由追加
        const addItem = () => {
            if (!newItemName.value.trim()) return;
            items.value.unshift({ item_name: newItemName.value, checked: false });
            newItemName.value = '';
        };


        // リストの削除
        const removeItem = (index) => {
            items.value.splice(index, 1);
        };

        // サーバーに新規保存
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

        // 保存済みリストの読み込み
        const loadSharedList = async (id) => {
            try {
                const res = await fetch(`api.php?id=${id}`);
                const data = await res.json();
                if (data.error) throw new Error();
                
                items.value = data.items;
                currentScope.value = data.info.scope;
                stayDays.value = data.info.stay_days;
                mode.value = 'view';
            } catch (e) {
                alert("リストの読み込みに失敗しました");
                resetToSetup();
            }
        };

        // チェック状態の同期（更新）
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

        const resetToSetup = () => {
            window.location.href = window.location.pathname;
        };

        return { 
            mode, items, currentScope, stayDays, newItemName, 
            processing, shareUrl, statusMsg, 
            generateList, addItem, saveList, updateList, resetToSetup, removeItem, showTerms
        };
    }
}).mount('#app');