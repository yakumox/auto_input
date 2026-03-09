// popup.js
// 実際の入力・収集処理は content/content.js に委譲する（sendMessage経由）

const profileSelect       = document.getElementById('profileSelect');
const btnInput            = document.getElementById('btnInput');
const btnMemorize         = document.getElementById('btnMemorize');
const btnSettings         = document.getElementById('btnSettings');
const statusMessage       = document.getElementById('statusMessage');
const newProfileForm      = document.getElementById('newProfileForm');
const newProfileNameInput = document.getElementById('newProfileNameInput');
const btnConfirmNew       = document.getElementById('btnConfirmNew');
const btnCancelNew        = document.getElementById('btnCancelNew');

// 「新規作成」前に選択されていた値を記憶
let lastSelectedProfileId = '';

// ストレージからプロファイル一覧を読み込む
async function loadProfiles() {
  const data = await chrome.storage.local.get('profiles');
  const profiles = data.profiles || {};
  const selectedId = (await chrome.storage.local.get('selectedProfileId')).selectedProfileId || '';

  profileSelect.innerHTML = '<option value="">-- プロファイルなし --</option>';
  Object.entries(profiles).forEach(([id, profile]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = profile.name;
    profileSelect.appendChild(option);
  });
  // 「新規作成」オプションを末尾に追加
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '＋ 新規作成...';
  profileSelect.appendChild(newOpt);

  if (selectedId && profiles[selectedId]) {
    profileSelect.value = selectedId;
    lastSelectedProfileId = selectedId;
  }
}

// プロファイル選択変更時
profileSelect.addEventListener('change', async () => {
  if (profileSelect.value === '__new__') {
    // 「新規作成」が選ばれたらフォームを表示
    newProfileForm.classList.remove('hidden');
    newProfileNameInput.value = '';
    setTimeout(() => newProfileNameInput.focus(), 50);
    return;
  }
  // 通常の選択
  newProfileForm.classList.add('hidden');
  lastSelectedProfileId = profileSelect.value;
  await chrome.storage.local.set({ selectedProfileId: profileSelect.value });
});

// 新規プロファイル作成: 確定
btnConfirmNew.addEventListener('click', async () => {
  const name = newProfileNameInput.value.trim();
  if (!name) {
    newProfileNameInput.focus();
    return;
  }
  const id = 'profile_' + Date.now();
  const data = await chrome.storage.local.get('profiles');
  const profiles = data.profiles || {};
  profiles[id] = { name, fields: [] };
  await chrome.storage.local.set({ profiles, selectedProfileId: id });

  newProfileForm.classList.add('hidden');
  await loadProfiles();
  profileSelect.value = id;
  lastSelectedProfileId = id;
  showStatus(`「${name}」を作成しました ✓`, 'success');
});

// 新規プロファイル作成: Enterキーでも確定
newProfileNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnConfirmNew.click();
  if (e.key === 'Escape') btnCancelNew.click();
});

// 新規プロファイル作成: キャンセル
btnCancelNew.addEventListener('click', () => {
  newProfileForm.classList.add('hidden');
  // 元の選択に戻す
  profileSelect.value = lastSelectedProfileId;
});

// 「入力」ボタン
btnInput.addEventListener('click', async () => {
  const profileId = profileSelect.value;
  if (!profileId || profileId === '__new__') {
    showStatus('プロファイルを選択してください', 'error');
    return;
  }

  const data = await chrome.storage.local.get('profiles');
  const profiles = data.profiles || {};
  const profile = profiles[profileId];

  if (!profile || !profile.fields || profile.fields.length === 0) {
    showStatus('設定された入力項目がありません', 'error');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'applyInputs',
      fields: profile.fields
    });
    if (response && response.success) {
      showStatus(`${response.count}件を入力しました ✓`, 'success');
    } else {
      showStatus('入力できませんでした', 'error');
    }
  } catch (e) {
    showStatus('入力に失敗しました。ページを再読み込みしてください。', 'error');
  }
});

// 「記憶」ボタン
btnMemorize.addEventListener('click', async () => {
  const profileId = profileSelect.value;
  if (!profileId || profileId === '__new__') {
    showStatus('プロファイルを選択してください', 'error');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'collectInputs' });

    if (!response || !response.success) {
      showStatus('記憶に失敗しました', 'error');
      return;
    }

    const fields = response.fields;
    if (!fields || fields.length === 0) {
      showStatus('入力可能な要素が見つかりません', 'info');
      return;
    }

    const data = await chrome.storage.local.get('profiles');
    const profiles = data.profiles || {};
    if (profiles[profileId]) {
      profiles[profileId].fields = fields;
      await chrome.storage.local.set({ profiles });
      showStatus(`${fields.length}件の入力内容を記憶しました ✓`, 'success');
    }
  } catch (e) {
    showStatus('記憶に失敗しました。ページを再読み込みしてください。', 'error');
  }
});

// 「設定」ボタン
btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ステータスメッセージ表示
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  setTimeout(() => {
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
  }, 3000);
}

// 初期化
loadProfiles();
