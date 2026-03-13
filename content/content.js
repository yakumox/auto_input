// content.js
// Auto Input - コンテントスクリプト

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 送信元が拡張機能自身でない場合は無視する（第三者からのメッセージを拒否）
  if (sender.id !== chrome.runtime.id) return;

  if (message.action === 'applyInputs') {
    // 入力前にページの全フォームをクリア
    clearAllInputs();
    const count = applyInputs(message.fields);
    sendResponse({ success: true, count });
  } else if (message.action === 'collectInputs') {
    // 現在の入力内容を収集（呼び出し元で profile.fields を全置換する）
    const fields = collectInputs();
    sendResponse({ success: true, fields });
  }
  return true;
});

// ============================================================
// ページの全フォーム入力をクリアする
// ============================================================
function clearAllInputs() {
  const elements = document.querySelectorAll('input, select, textarea');
  elements.forEach(el => {
    const tagName = el.tagName.toLowerCase();
    const type    = (el.type || '').toLowerCase();

    // クリア対象外
    if (type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return;
    if (type === 'hidden') return;
    if (type === 'file') return;

    try {
      if (tagName === 'select') {
        if (el.multiple) {
          // select[multiple]: 全オプションの選択を解除する
          Array.from(el.options).forEach(o => { o.selected = false; });
        } else {
          // select（単一）: 先頭オプションに戻す（空値があれば空値、なければ index 0）
          el.value = '';
          if (el.value === '' && el.options.length > 0 && el.options[0].value !== '') {
            el.selectedIndex = 0;
          }
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));

      } else if (type === 'checkbox') {
        // checkbox: チェックを外す
        if (el.checked) {
          el.checked = false;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

      } else if (type === 'radio') {
        // radio: すべてのラジオのチェックを外す
        if (el.checked) {
          el.checked = false;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

      } else if (tagName === 'input' || tagName === 'textarea') {
        // input / textarea: 値を空にする（React等フレームワーク対応）
        const proto = tagName === 'textarea'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(el, '');
        } else {
          el.value = '';
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (err) {
      console.warn('[Auto Input] Error clearing value on element:', err);
    }
  });
}

// ============================================================
// フィールドへの入力を適用する
// ============================================================
function applyInputs(fields) {
  // 入力値の基本検証（配列でない場合は安全に終了）
  if (!Array.isArray(fields)) return 0;

  let count = 0;

  fields.forEach(field => {
    // field オブジェクトの型チェック
    if (!field || typeof field !== 'object') return;
    if (typeof field.selector !== 'string') return;
    if (field.value !== undefined && typeof field.value !== 'string' && typeof field.value !== 'boolean') return;
    if (!field.selector) return;

    let elements = [];
    try {
      elements = Array.from(document.querySelectorAll(field.selector));
    } catch (e) {
      console.warn('[Auto Input] Invalid selector:', field.selector, e);
      return;
    }
    if (elements.length === 0) return;

    elements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      const elType  = (el.type || '').toLowerCase();

      // passwordフィールドへの書き込みは行わない（保持しない仕様のため）
      if (elType === 'password') return;

      try {
        if (tagName === 'select') {
          // ---- select ----
          if (el.multiple) {
            // select[multiple]: JSON 配列文字列をパースして複数選択を適用する
            let values = [];
            try {
              const parsed = JSON.parse(field.value);
              if (Array.isArray(parsed)) values = parsed;
            } catch (_) {
              // JSON でない場合は単一値として扱う
              if (field.value) values = [field.value];
            }
            // 全オプションの selected を一旦リセットしてから対象を選択
            Array.from(el.options).forEach(o => {
              o.selected = values.includes(o.value);
            });
            el.dispatchEvent(new Event('change', { bubbles: true }));
            count++;
          } else {
            // select（単一）: value またはテキストで一致するオプションを選択
            const options = Array.from(el.options);
            const match = options.find(
              o => o.value === field.value || o.text.trim() === field.value
            );
            if (match) {
              el.value = match.value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              count++;
            }
          }

        } else if (elType === 'radio') {
          // ---- radio ----
          // セレクタは input[type="radio"][name="X"] でグループ全体を指す
          // el.value が field.value に一致するラジオをチェックする
          if (el.value === field.value) {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            count++;
          }

        } else if (elType === 'checkbox') {
          // ---- checkbox ----
          const shouldCheck = field.value === 'true' || field.value === true;
          if (el.checked !== shouldCheck) {
            el.checked = shouldCheck;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          count++;

        } else if (tagName === 'input' || tagName === 'textarea') {
          // ---- input / textarea (React等フレームワーク対応) ----
          const proto = tagName === 'textarea'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
          if (descriptor && descriptor.set) {
            descriptor.set.call(el, field.value);
          } else {
            el.value = field.value;
          }
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          count++;
        }
      } catch (err) {
        console.warn('[Auto Input] Error setting value on', field.selector, err);
      }
    });
  });

  return count;
}

// ============================================================
// 現在のページの入力内容を収集する
// ============================================================
function collectInputs() {
  const results         = [];
  const seenSelectors   = new Set();
  const seenRadioGroups = new Set(); // radio name グループを1件のみ収集

  const elements = document.querySelectorAll('input, select, textarea');

  elements.forEach(el => {
    const tagName = el.tagName.toLowerCase();
    const type    = (el.type || '').toLowerCase();

    // スキップする要素
    if (type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return;
    if (type === 'hidden') return;
    if (type === 'file') return; // セキュリティ制限によりJS経由での値取得・設定が不可
    if (type === 'password') return; // パスワードを平文でストレージに保存しない（セキュリティ対策）
    // radio/checkbox はカスタムCSSで display:none にされることが多いため offsetParent チェックを除外
    if (type !== 'radio' && type !== 'checkbox' && el.offsetParent === null) return;

    let selector = '';
    let value    = '';
    let label    = '';

    // ---- radio ボタンの特別処理 ----
    if (type === 'radio') {
      const groupName = el.name;
      if (!groupName || seenRadioGroups.has(groupName)) return;
      seenRadioGroups.add(groupName);

      const escaped = groupName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      selector = `input[type="radio"][name="${escaped}"]`;
      if (seenSelectors.has(selector)) return;
      seenSelectors.add(selector);

      // チェックされているラジオの value を記録
      const allInGroup = Array.from(
        document.querySelectorAll(`input[type="radio"][name="${groupName}"]`)
      );
      const checkedRadio = allInGroup.find(r => r.checked);
      value = checkedRadio ? checkedRadio.value : (allInGroup[0] ? allInGroup[0].value : '');

      // ラベル取得 (グループ先頭の要素から)
      const first = allInGroup[0] || el;
      label = getLabelForEl(first) || groupName;

    } else {
      // ---- その他の要素 ----

      // checkbox かつ name がある場合は value 属性も含めた一意セレクタを生成する
      // （同一 name の複数 checkbox を個別に識別するため）
      if (type === 'checkbox' && el.name && !el.id) {
        const escapedName  = el.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedValue = (el.value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        selector = `input[type="checkbox"][name="${escapedName}"][value="${escapedValue}"]`;
      } else {
        selector = generateSelector(el);
      }

      if (!selector || seenSelectors.has(selector)) return;
      seenSelectors.add(selector);

      if (tagName === 'select') {
        if (el.multiple) {
          // select[multiple]: 選択中の全 value を JSON 配列文字列で保持する
          value = JSON.stringify(
            Array.from(el.selectedOptions).map(o => o.value)
          );
        } else {
          value = el.value;
        }
      } else if (type === 'checkbox') {
        value = el.checked ? 'true' : 'false';
      } else {
        value = el.value;
      }

      label = getLabelForEl(el);
      if (!label) label = selector;
    }

    results.push({ selector, label, tagName, type, value });
  });

  return results;
}

// ラベルテキストを取得するヘルパー
function getLabelForEl(el) {
  if (el.id) {
    try {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) return labelEl.textContent.trim();
    } catch (_) {}
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl) return labelEl.textContent.trim();
  }
  if (el.placeholder) return el.placeholder;
  if (el.name) return el.name;
  return '';
}

// 要素のCSSセレクタを生成する
function generateSelector(el) {
  if (el.id) {
    try { return '#' + CSS.escape(el.id); } catch (_) { return '#' + el.id; }
  }
  if (el.name) {
    const tag     = el.tagName.toLowerCase();
    const escaped = el.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${tag}[name="${escaped}"]`;
  }

  const parts = [];
  let current = el;

  while (current && current.tagName && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      try { part = '#' + CSS.escape(current.id); } catch (_) { part = '#' + current.id; }
      parts.unshift(part);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
    if (parts.length >= 4) break;
  }

  return parts.join(' > ');
}
