import type { C2PaParseResult } from './parser';
import { getResultCopy } from './copy';

export type UIState =
  | { type: 'idle' }
  | { type: 'loading'; fileName: string }
  | { type: 'result'; result: C2PaParseResult; fileName: string };

export interface UICallbacks {
  onFileSelect: (file: File) => void;
  onReset: () => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 「封印(Seal)」モチーフのブランドマーク。二重リング + チェックで
// 「検証済みの証」を表す。ヘッダーの3状態すべてで共通利用する。
const BRAND_ICON_SVG = `
  <svg class="brand-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 3.5" opacity="0.55" />
    <path d="M8.4 12.3l2.3 2.3 4.6-5.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

// Drop Zone のアイコン。画像を検証する道具であることを示す
// 「画像フレーム」の意匠にする（汎用フォルダアイコンを避ける）。
const DROP_ICON_SVG = `
  <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
    <rect x="5" y="7" width="30" height="26" rx="3" stroke="currentColor" stroke-width="1.6" />
    <circle cx="14.5" cy="15.5" r="2.4" stroke="currentColor" stroke-width="1.6" />
    <path d="M8 27l7.5-7.5 5 4.5L27 15l6.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

const FILE_ICON_SVG = `
  <svg class="file-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="M4 1.5h5l3 3v10H4v-13z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    <path d="M9 1.5v3h3" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
  </svg>
`;

export function renderApp(
  container: HTMLElement,
  state: UIState,
  callbacks: UICallbacks
): void {
  if (state.type === 'idle') {
    renderIdleState(container, callbacks);
  } else if (state.type === 'loading') {
    renderLoadingState(container, state.fileName);
  } else if (state.type === 'result') {
    renderResultState(container, state.result, state.fileName, callbacks);
  }
}

function renderIdleState(container: HTMLElement, callbacks: UICallbacks): void {
  container.innerHTML = `
    <div class="app-container">
      <header class="app-header">
        <div class="brand">
          ${BRAND_ICON_SVG}
          <h1>C2PA Viewer</h1>
        </div>
        <p class="subtitle">画像に埋め込まれた Content Credentials (C2PA) をブラウザ内だけで解析・検証</p>
      </header>

      <main class="main-content">
        <div class="drop-zone" id="drop-zone" tabindex="0" role="button" aria-label="画像ファイルをドロップまたは選択">
          <input type="file" id="file-input" class="file-input" accept="image/jpeg,image/png,image/webp" />
          <div class="drop-zone-content">
            <div class="drop-icon" aria-hidden="true">${DROP_ICON_SVG}</div>
            <p class="drop-primary-text">画像をここにドラッグ＆ドロップ</p>
            <p class="drop-secondary-text">または <label for="file-input" class="file-select-btn">ファイルを選択</label></p>
            <p class="drop-formats">対応フォーマット: JPEG / PNG / WebP</p>
          </div>
        </div>

        <div class="privacy-badge">
          <span class="privacy-badge-text">🔒 画像は外部送信されません</span>
        </div>
      </main>
    </div>
  `;

  const dropZone = container.querySelector<HTMLElement>('#drop-zone');
  const fileInput = container.querySelector<HTMLInputElement>('#file-input');

  if (!dropZone || !fileInput) return;

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      callbacks.onFileSelect(files[0]);
    }
  };

  // D&D Handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer?.files || null);
  });

  // Click & Keyboard Handlers
  dropZone.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // file-input 自身や label へのクリック重複を回避
    if (target !== fileInput && target.tagName !== 'LABEL') {
      fileInput.click();
    }
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
  });
}

function renderLoadingState(container: HTMLElement, fileName: string): void {
  container.innerHTML = `
    <div class="app-container">
      <header class="app-header header-compact">
        <div class="brand">
          ${BRAND_ICON_SVG}
          <h1>C2PA Viewer</h1>
        </div>
      </header>

      <main class="main-content">
        <div class="loading-card">
          <div class="spinner" aria-hidden="true"></div>
          <p class="loading-text">C2PA データを解析中...</p>
          <p class="loading-filename">${escapeHtml(fileName)}</p>
        </div>
      </main>
    </div>
  `;
}

function renderResultState(
  container: HTMLElement,
  result: C2PaParseResult,
  fileName: string,
  callbacks: UICallbacks
): void {
  const copy = getResultCopy(result);

  container.innerHTML = `
    <div class="app-container">
      <header class="app-header header-compact">
        <div class="brand">
          ${BRAND_ICON_SVG}
          <h1>C2PA Viewer</h1>
        </div>
        <button id="reset-btn" class="reset-btn" type="button">← 別の画像を検証する</button>
      </header>

      <main class="main-content">
        <div class="file-banner">
          <span class="file-name">${FILE_ICON_SVG}${escapeHtml(fileName)}</span>
          <span class="privacy-tag">🔒 外部送信なし</span>
        </div>

        <!-- 結果概要カード -->
        <section class="result-card status-${escapeHtml(result.status)}" aria-label="解析結果">
          <div class="result-header">
            <span class="result-icon" aria-hidden="true">${escapeHtml(copy.icon)}</span>
            <h2 class="result-title">${escapeHtml(copy.title)}</h2>
          </div>

          <div class="result-body">
            <p>${escapeHtml(copy.body).replace(/\n/g, '<br/>')}</p>
          </div>

          ${
            copy.warnings && copy.warnings.length > 0
              ? `
            <div class="warnings-box">
              ${copy.warnings
                .map((w) => `<div class="warning-item">${escapeHtml(w)}</div>`)
                .join('')}
            </div>
          `
              : ''
          }

          ${
            copy.detailFields && copy.detailFields.length > 0
              ? `
            <div class="detail-fields-grid">
              ${copy.detailFields
                .map(
                  (f) => `
                <div class="detail-field-item">
                  <span class="field-label">${escapeHtml(f.label)}</span>
                  <span class="field-value">${escapeHtml(f.value)}</span>
                </div>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        </section>

        <!-- Manifest 詳細画面 -->
        <section class="details-section" aria-label="Manifest詳細情報">
          <h3 class="section-title">Manifest 詳細情報</h3>

          <div class="manifest-grid">
            <div class="grid-card">
              <span class="grid-label">Claim Generator</span>
              <span class="grid-value">${escapeHtml(result.claimGenerator || 'なし')}</span>
            </div>
            <div class="grid-card">
              <span class="grid-label">Digital Source Type</span>
              <span class="grid-value">${escapeHtml(result.digitalSourceType || 'なし')}</span>
            </div>
            <div class="grid-card">
              <span class="grid-label">Format</span>
              <span class="grid-value">${escapeHtml(result.format || '不明')}</span>
            </div>
            <div class="grid-card">
              <span class="grid-label">Signature Issuer</span>
              <span class="grid-value">${escapeHtml(result.signatureIssuer || 'なし')}</span>
            </div>
            <div class="grid-card">
              <span class="grid-label">Assertions 数</span>
              <span class="grid-value">${result.assertionsCount}</span>
            </div>
            <div class="grid-card">
              <span class="grid-label">Ingredients 数</span>
              <span class="grid-value">${result.ingredientsCount}</span>
            </div>
          </div>

          ${
            result.actions && result.actions.length > 0
              ? `
            <div class="actions-box">
              <h4 class="sub-title">Actions (${result.actions.length})</h4>
              <ul class="actions-list">
                ${result.actions
                  .map(
                    (act) => `
                  <li>
                    <strong>${escapeHtml(act.action)}</strong>
                    ${
                      act.digitalSourceType
                        ? `<span class="action-ds">(${escapeHtml(act.digitalSourceType)})</span>`
                        : ''
                    }
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }

          <!-- 折りたたみセクション -->
          <div class="accordion-group">
            <details class="accordion-item">
              <summary class="accordion-header">Ingredients (${result.ingredientsCount})</summary>
              <div class="accordion-content">
                ${renderIngredients(result)}
              </div>
            </details>

            <details class="accordion-item">
              <summary class="accordion-header">Assertions (${result.assertionsCount})</summary>
              <div class="accordion-content">
                ${renderAssertions(result)}
              </div>
            </details>

            <details class="accordion-item">
              <summary class="accordion-header">Validation</summary>
              <div class="accordion-content">
                ${renderValidation(result)}
              </div>
            </details>

            <details class="accordion-item" id="raw-manifest-details">
              <summary class="accordion-header">Raw Manifest</summary>
              <div class="accordion-content">
                <div class="raw-manifest-container">
                  <div class="raw-manifest-toolbar">
                    <span class="toolbar-title">ManifestStore (JSON)</span>
                    <button id="copy-json-btn" class="copy-btn" type="button">📋 JSONをコピー</button>
                  </div>
                  <pre class="json-code"><code>${escapeHtml(
                    JSON.stringify(result.manifestStore ?? null, null, 2)
                  )}</code></pre>
                </div>
              </div>
            </details>
          </div>
        </section>
      </main>
    </div>
  `;

  // Reset Button Event
  const resetBtn = container.querySelector<HTMLButtonElement>('#reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      callbacks.onReset();
    });
  }

  // Copy JSON Button Event
  const copyBtn = container.querySelector<HTMLButtonElement>('#copy-json-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const jsonText = JSON.stringify(result.manifestStore ?? null, null, 2);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(jsonText);
        } else {
          // fallback for environments without clipboard API
          const textarea = document.createElement('textarea');
          textarea.value = jsonText;
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (!success) {
            throw new Error('Copy command failed');
          }
        }
        copyBtn.textContent = '✓ コピー完了！';
        setTimeout(() => {
          copyBtn.textContent = '📋 JSONをコピー';
        }, 2000);
      } catch {
        copyBtn.textContent = '❌ コピー失敗';
        setTimeout(() => {
          copyBtn.textContent = '📋 JSONをコピー';
        }, 2000);
      }
    });
  }
}

function renderIngredients(result: C2PaParseResult): string {
  const ingredients = result.activeManifest?.ingredients;
  if (!ingredients || ingredients.length === 0) {
    return '<p class="empty-text">Ingredients 情報はありません。</p>';
  }
  return `
    <ul class="detail-list">
      ${ingredients
        .map(
          (ing, i) => `
        <li>
          <strong>[${i + 1}] ${escapeHtml(ing.title || ing.format || 'Unnamed Ingredient')}</strong>
          ${ing.relationship ? `<span class="badge">${escapeHtml(ing.relationship)}</span>` : ''}
          ${
            ing.active_manifest
              ? `<div class="sub-info">Manifest: ${escapeHtml(ing.active_manifest)}</div>`
              : ''
          }
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

function renderAssertions(result: C2PaParseResult): string {
  const assertions = result.activeManifest?.assertions;
  if (!assertions || assertions.length === 0) {
    return '<p class="empty-text">Assertions 情報はありません。</p>';
  }
  return `
    <ul class="detail-list">
      ${assertions
        .map(
          (a) => `
        <li>
          <code>${escapeHtml(a.label)}</code>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

function renderValidation(result: C2PaParseResult): string {
  if (result.validationErrors && result.validationErrors.length > 0) {
    return `
      <div class="validation-issues">
        <p class="warning-header">検出されたエラー / 警告:</p>
        <ul>
          ${result.validationErrors.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  if (result.status === 'verified') {
    return '<p class="success-text">✓ Validation エラーは検出されませんでした。</p>';
  }
  return '<p class="empty-text">検証未実施</p>';
}
