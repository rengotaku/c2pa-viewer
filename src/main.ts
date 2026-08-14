import './style.css';
import { isSupportedFormat, readC2Pa } from './c2pa';
import type { C2PaParseResult } from './parser';
import { renderApp, type UIState } from './ui';

const appEl = document.querySelector<HTMLElement>('#app');
if (!appEl) {
  throw new Error('Target element #app not found in DOM.');
}

let currentState: UIState = { type: 'idle' };

function updateUI(newState: UIState): void {
  currentState = newState;
  renderApp(appEl!, currentState, {
    onFileSelect: handleFileSelect,
    onReset: handleReset,
  });
}

async function handleFileSelect(file: File): Promise<void> {
  updateUI({ type: 'loading', fileName: file.name });

  // フォーマットチェック: JPEG, PNG, WebP 以外は unsupported-or-error として処理
  if (!isSupportedFormat(file.type, file.name)) {
    const unsupportedResult: C2PaParseResult = {
      status: 'unsupported-or-error',
      error: new Error(
        `未対応のファイルフォーマットです (${file.type || '不明'})。対応形式は JPEG, PNG, WebP です。`
      ),
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
    };
    updateUI({ type: 'result', result: unsupportedResult, fileName: file.name });
    return;
  }

  try {
    const result = await readC2Pa(file);
    updateUI({ type: 'result', result, fileName: file.name });
  } catch (err) {
    const errorResult: C2PaParseResult = {
      status: 'unsupported-or-error',
      error:
        err instanceof Error
          ? err
          : new Error('C2PA データの解析中にエラーが発生しました。'),
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
    };
    updateUI({ type: 'result', result: errorResult, fileName: file.name });
  }
}

function handleReset(): void {
  updateUI({ type: 'idle' });
}

// 初期化描画
updateUI({ type: 'idle' });
