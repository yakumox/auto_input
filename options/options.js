// options.js

// --- DOM要素の取得 ---
const profileList       = document.getElementById('profileList');
const btnNewProfile     = document.getElementById('btnNewProfile');
const noProfileSelected = document.getElementById('noProfileSelected');
const profileEditor     = document.getElementById('profileEditor');
const profileNameInput  = document.getElementById('profileName');
const btnDeleteProfile  = document.getElementById('btnDeleteProfile');
const btnAddField       = document.getElementById('btnAddField');
const fieldsList        = document.getElementById('fieldsList');
const emptyFields       = document.getElementById('emptyFields');
const btnSave           = document.getElementById('btnSave');
const saveStatus        = document.getElementById('saveStatus');

// 新規プロファイルダイアログ
const newProfileDialog  = document.getElementById('newProfileDialog');
const newProfileNameInput = document.getElementById('newProfileName');
const btnCreateProfile  = document.getElementById('btnCreateProfile');
const btnCancelCreate   = document.getElementById('btnCancelCreate');

// 削除確認ダイアログ
const deleteDialog      = document.getElementById('deleteDialog');
const deleteDialogMsg   = document.getElementById('deleteDialogMsg');
const btnConfirmDelete  = document.getElementById('btnConfirmDelete');
const btnCancelDelete   = document.getElementById('btnCancelDelete');

// エクスポート／インポート
const btnExport         = document.getElementById('btnExport');
const btnImport         = document.getElementById('btnImport');
const importFileInput   = document.getElementById('importFileInput');

// インポート確認ダイアログ
const importDialog      = document.getElementById('importDialog');
const importDialogMsg   = document.getElementById('importDialogMsg');
const btnImportMerge    = document.getElementById('btnImportMerge');
const btnImportReplace  = document.getElementById('btnImportReplace');
const btnCancelImport   = document.getElementById('btnCancelImport');

// --- 状態 ---
let profiles = {};         // { id: { name, fields: [...] } }
let currentProfileId = null;

// --- 初期化 ---
async function init() {
  const data = await chrome.storage.local.get(['profiles', 'selectedProfileId']);
  profiles = data.profiles || {};
  renderProfileList();

  // 選択中のプロファイルを表示
  const selectedId = data.selectedProfileId;
  if (selectedId && profiles[selectedId]) {
    selectProfile(selectedId);
  }
}

// --- プロファイル一覧を描画 ---
function renderProfileList() {
  profileList.innerHTML = '';
  const entries = Object.entries(profiles);
  if (entries.length === 0) {
    const li = document.createElement('li');
    li.textContent = '(プロファイルなし)';
    li.style.color = 'rgba(255,255,255,0.3)';
    li.style.cursor = 'default';
    li.style.fontSize = '12px';
    profileList.appendChild(li);
    return;
  }
  entries.forEach(([id, profile]) => {
    const li = document.createElement('li');
    li.textContent = profile.name || '(名前なし)';
    li.dataset.id = id;
    if (id === currentProfileId) li.classList.add('active');
    li.addEventListener('click', () => selectProfile(id));
    profileList.appendChild(li);
  });
}

// --- プロファイルを選択 ---
function selectProfile(id) {
  currentProfileId = id;
  const profile = profiles[id];
  if (!profile) return;

  // サイドバーのアクティブ状態を更新
  document.querySelectorAll('#profileList li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  // エディタを表示
  noProfileSelected.style.display = 'none';
  profileEditor.classList.remove('hidden');

  // プロファイル名
  profileNameInput.value = profile.name || '';

  // フィールドを描画
  renderFields(profile.fields || []);

  // 保存状態をリセット
  saveStatus.textContent = '';
  saveStatus.className = 'save-status';
}

// --- フィールドを描画 ---
function renderFields(fields) {
  fieldsList.innerHTML = '';

  // ヘッダー行
  if (fields.length > 0) {
    const header = document.createElement('div');
    header.className = 'fields-col-header';
    header.innerHTML = `
      <span class="h-num">#</span>
      <span class="h-label">ラベル</span>
      <span class="h-type">タイプ</span>
      <span class="h-selector">CSSセレクタ</span>
      <span class="h-value">値</span>
      <span class="h-del"></span>
    `;
    fieldsList.appendChild(header);
  }

  // passwordタイプは保持しない仕様のため描画対象から除外する
  const safeFields = fields.filter(f => (f.type || 'text') !== 'password');

  safeFields.forEach((field, index) => {
    fieldsList.appendChild(createFieldRow(field, index));
    updateRowTypeStyle(fieldsList.lastElementChild, field.type || 'text');
  });

  emptyFields.style.display = fields.length === 0 ? 'block' : 'none';
}

// --- フィールド行を作成 ---
function createFieldRow(field, index) {
  const fieldType = field.type || 'text';
  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.index = index;
  row.dataset.type = fieldType;

  // タイプ選択肢（password は保持しない仕様のため除外）
  const typeOptions = [
    { value: 'text',     label: 'text' },
    { value: 'email',    label: 'email' },
    { value: 'tel',      label: 'tel' },
    { value: 'number',   label: 'number' },
    { value: 'date',     label: 'date' },
    { value: 'textarea', label: 'textarea' },
    { value: 'select',   label: 'select' },
    { value: 'radio',    label: 'radio' },
    { value: 'checkbox', label: 'checkbox' },
  ];
  const typeOptionsHtml = typeOptions.map(
    o => `<option value="${o.value}"${fieldType === o.value ? ' selected' : ''}>${o.label}</option>`
  ).join('');

  // valueのplaceholderをtypeに応じて変える
  const valuePlaceholder = fieldType === 'radio'
    ? 'ラジオのvalue属性'
    : fieldType === 'checkbox'
    ? 'true または false'
    : fieldType === 'select'
    ? 'option値 or 表示テキスト'
    : '入力する値';

  row.innerHTML = `
    <span class="field-row-number">${index + 1}</span>
    <div class="field-col field-col-label-text">
      <span class="field-col-label">ラベル</span>
      <input type="text" class="field-label-input" placeholder="名前など" value="${escHtml(field.label || '')}">
    </div>
    <div class="field-col field-col-type">
      <span class="field-col-label">タイプ</span>
      <select class="field-type-select">${typeOptionsHtml}</select>
    </div>
    <div class="field-col field-col-selector">
      <span class="field-col-label">CSSセレクタ</span>
      <input type="text" class="field-selector-input" placeholder="#email" value="${escHtml(field.selector || '')}">
    </div>
    <div class="field-col field-col-value">
      <span class="field-col-label">値</span>
      <input type="text" class="field-value-input" placeholder="${valuePlaceholder}" value="${escHtml(field.value || '')}">
    </div>
    <button class="field-delete-btn" title="削除">✕</button>
  `;

  // タイプ変更時: 行のスタイルとplaceholderを更新
  const typeSelect = row.querySelector('.field-type-select');
  const valueInput = row.querySelector('.field-value-input');
  typeSelect.addEventListener('change', () => {
    const t = typeSelect.value;
    row.dataset.type = t;
    updateRowTypeStyle(row, t);
    valueInput.placeholder =
      t === 'radio'    ? 'ラジオのvalue属性' :
      t === 'checkbox' ? 'true または false' :
      t === 'select'   ? 'option値 or 表示テキスト' : '入力する値';
  });

  // 削除ボタン
  row.querySelector('.field-delete-btn').addEventListener('click', () => {
    deleteField(index);
  });

  return row;
}

// --- タイプに応じた行スタイルを適用 ---
function updateRowTypeStyle(row, type) {
  if (!row) return;
  row.dataset.type = type || 'text';
}

// --- フィールドを削除 ---
function deleteField(index) {
  const profile = profiles[currentProfileId];
  if (!profile) return;
  profile.fields = profile.fields || [];
  profile.fields.splice(index, 1);
  renderFields(profile.fields);
}

// --- フィールドを追加 ---
btnAddField.addEventListener('click', () => {
  const profile = profiles[currentProfileId];
  if (!profile) return;
  profile.fields = profile.fields || [];
  profile.fields.push({ label: '', selector: '', value: '' });
  renderFields(profile.fields);

  // 追加した行にフォーカス
  const rows = fieldsList.querySelectorAll('.field-row');
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    lastRow.querySelector('.field-label-input').focus();
    lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

// --- 保存 ---
btnSave.addEventListener('click', async () => {
  if (!currentProfileId) return;

  const profile = profiles[currentProfileId];
  if (!profile) return;

  // プロファイル名を更新
  const newName = profileNameInput.value.trim();
  if (!newName) {
    showSaveStatus('プロファイル名を入力してください', 'error');
    profileNameInput.focus();
    return;
  }
  profile.name = newName;

  // フィールドの内容を収集
  const rows = fieldsList.querySelectorAll('.field-row');
  const fields = [];
  rows.forEach(row => {
    const label    = row.querySelector('.field-label-input').value.trim();
    const type     = row.querySelector('.field-type-select')?.value || 'text';
    const selector = row.querySelector('.field-selector-input').value.trim();
    const value    = row.querySelector('.field-value-input').value;
    // passwordタイプは保持しない仕様のため保存対象から除外する
    if (selector && type !== 'password') {
      fields.push({ label, type, selector, value });
    }
  });
  profile.fields = fields;

  // ストレージに保存
  try {
    await chrome.storage.local.set({ profiles });
    showSaveStatus('保存しました ✓', 'success');
  } catch (e) {
    console.error('[Auto Input] Storage error', e);
    showSaveStatus('保存に失敗しました', 'error');
  }

  // サイドバーを再描画（名前変更に対応）
  renderProfileList();
  // アクティブ状態を復元
  document.querySelectorAll('#profileList li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === currentProfileId);
  });
});

// --- 保存状態表示 ---
function showSaveStatus(msg, type) {
  saveStatus.textContent = msg;
  saveStatus.className = 'save-status' + (type === 'error' ? ' error' : '');
  if (type !== 'error') {
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2500);
  }
}

// --- 新規プロファイル作成 ---
btnNewProfile.addEventListener('click', () => {
  newProfileNameInput.value = '';
  newProfileDialog.classList.remove('hidden');
  setTimeout(() => newProfileNameInput.focus(), 50);
});

btnCancelCreate.addEventListener('click', () => {
  newProfileDialog.classList.add('hidden');
});

newProfileDialog.addEventListener('click', (e) => {
  if (e.target === newProfileDialog) newProfileDialog.classList.add('hidden');
});

newProfileNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnCreateProfile.click();
  if (e.key === 'Escape') btnCancelCreate.click();
});

btnCreateProfile.addEventListener('click', async () => {
  const name = newProfileNameInput.value.trim();
  if (!name) {
    newProfileNameInput.focus();
    return;
  }

  const id = 'profile_' + Date.now();
  profiles[id] = { name, fields: [] };

  await chrome.storage.local.set({ profiles });
  newProfileDialog.classList.add('hidden');

  renderProfileList();
  selectProfile(id);

  // ポップアップの選択も更新
  chrome.storage.local.set({ selectedProfileId: id });
});

// --- プロファイル削除 ---
btnDeleteProfile.addEventListener('click', () => {
  if (!currentProfileId) return;
  const profile = profiles[currentProfileId];
  if (!profile) return;
  deleteDialogMsg.textContent = `「${profile.name}」を削除しますか？この操作は元に戻せません。`;
  deleteDialog.classList.remove('hidden');
});

btnCancelDelete.addEventListener('click', () => {
  deleteDialog.classList.add('hidden');
});

deleteDialog.addEventListener('click', (e) => {
  if (e.target === deleteDialog) deleteDialog.classList.add('hidden');
});

btnConfirmDelete.addEventListener('click', async () => {
  if (!currentProfileId) return;
  delete profiles[currentProfileId];
  currentProfileId = null;

  await chrome.storage.local.set({ profiles });
  deleteDialog.classList.add('hidden');

  renderProfileList();
  noProfileSelected.style.display = '';
  profileEditor.classList.add('hidden');
});

// --- HTMLエスケープ ---
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')   // シングルクォートもエスケープ（XSS対策）
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// --- エクスポート ---
// ============================================================
btnExport.addEventListener('click', async () => {
  const data = await chrome.storage.local.get('profiles');
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: data.profiles || {}
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href     = url;
  a.download = `auto_input_profiles_${timestamp}.json`;
  a.click();

  URL.revokeObjectURL(url);
});

// ============================================================
// --- インポート ---
// ============================================================

// インポートボタン → ファイル選択ダイアログを開く
btnImport.addEventListener('click', () => {
  importFileInput.value = '';   // 同じファイルを再選択できるようリセット
  importFileInput.click();
});

// ファイルが選択されたら読み込んでダイアログを表示
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch {
      alert('JSONの解析に失敗しました。正しいエクスポートファイルを選択してください。');
      return;
    }

    // バリデーション
    if (!parsed || typeof parsed.profiles !== 'object' || parsed.profiles === null) {
      alert('ファイルの形式が正しくありません（"profiles" キーが見つかりません）。');
      return;
    }

    const importedProfiles = parsed.profiles;
    const validEntries = Object.entries(importedProfiles).filter(([, p]) =>
      p && typeof p.name === 'string' && Array.isArray(p.fields)
    );

    if (validEntries.length === 0) {
      alert('インポートできるプロファイルが見つかりませんでした。');
      return;
    }

    // 確認ダイアログを表示
    importDialogMsg.textContent =
      `${validEntries.length} 件のプロファイルが見つかりました。既存のプロファイルを保持したまま追加しますか？それとも既存を全て削除して置き換えますか？`;
    importDialog.classList.remove('hidden');

    // ダイアログのボタンに今回のデータを紐付け
    importDialog._pendingProfiles = Object.fromEntries(validEntries);
  };
  reader.readAsText(file);
});

// インポート確認ダイアログ: 追加
btnImportMerge.addEventListener('click', async () => {
  const incoming = importDialog._pendingProfiles;
  if (!incoming) return;

  // ストレージから最新の既存データを取得してからマージ
  // （メモリ上の profiles だけに頼ると、他の操作で更新されたデータが失われる可能性があるため）
  const stored = await chrome.storage.local.get('profiles');
  const base = stored.profiles || {};

  // 既存データを優先してマージ:
  //   - incoming を先に展開し、base を後から上書きすることで既存プロファイルは変更されない
  //   - incoming にしか存在しないIDのプロファイルだけが新規追加される
  const merged = Object.assign({}, incoming, base);

  // メモリ上の profiles も更新
  profiles = merged;

  await chrome.storage.local.set({ profiles: merged });
  importDialog.classList.add('hidden');
  importDialog._pendingProfiles = null;

  renderProfileList();
  // 選択中プロファイルがまだ存在するなら表示を維持する
  if (currentProfileId && profiles[currentProfileId]) {
    selectProfile(currentProfileId);
  }
  showImportSuccess(Object.keys(incoming).length, '追加');
});

// インポート確認ダイアログ: 置き換え
btnImportReplace.addEventListener('click', async () => {
  const incoming = importDialog._pendingProfiles;
  if (!incoming) return;

  profiles = incoming;
  currentProfileId = null;

  await chrome.storage.local.set({ profiles });
  importDialog.classList.add('hidden');
  importDialog._pendingProfiles = null;

  renderProfileList();
  noProfileSelected.style.display = '';
  profileEditor.classList.add('hidden');
  showImportSuccess(Object.keys(incoming).length, '置き換え');
});

// インポート確認ダイアログ: キャンセル
btnCancelImport.addEventListener('click', () => {
  importDialog.classList.add('hidden');
  importDialog._pendingProfiles = null;
});

importDialog.addEventListener('click', (e) => {
  if (e.target === importDialog) {
    importDialog.classList.add('hidden');
    importDialog._pendingProfiles = null;
  }
});

function showImportSuccess(count, mode) {
  // サイドバー下部に一時メッセージを表示
  const msg = document.createElement('p');
  msg.className = 'io-status';
  msg.textContent = `✓ ${count} 件を${mode}しました`;
  const actions = document.querySelector('.sidebar-actions');
  actions.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

// --- 起動 ---
init();
