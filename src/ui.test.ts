import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderApp, type UIState } from './ui';
import type { C2PaParseResult } from './parser';

describe('ui.ts DOM 結合テスト', () => {
  let container: HTMLElement;
  const mockCallbacks = {
    onFileSelect: vi.fn(),
    onReset: vi.fn(),
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockCallbacks.onFileSelect.mockClear();
    mockCallbacks.onReset.mockClear();
  });

  test('idle 状態の描画と D&D / file input 要素の確認', () => {
    renderApp(container, { type: 'idle' }, mockCallbacks);

    const dropZone = container.querySelector('#drop-zone');
    const fileInput = container.querySelector('#file-input');

    expect(dropZone).not.toBeNull();
    expect(fileInput).not.toBeNull();
    expect(container.textContent).toContain('🔒 画像は外部送信されません');
  });

  test('result 状態の描画とリセットボタンの動作検証', () => {
    const mockResult: C2PaParseResult = {
      status: 'verified',
      aiGenerationStatus: 'is_ai',
      claimGenerator: 'OpenAI / ChatGPT',
      signatureIssuer: 'OpenAI',
      assertionsCount: 3,
      ingredientsCount: 1,
    };

    const state: UIState = {
      type: 'result',
      result: mockResult,
      fileName: 'test-image.png',
    };

    renderApp(container, state, mockCallbacks);

    expect(container.textContent).toContain('test-image.png');
    expect(container.textContent).toContain('見つかりました');
    expect(container.textContent).toContain('OpenAI / ChatGPT');

    const resetBtn = container.querySelector('#reset-btn') as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();
    resetBtn.click();

    expect(mockCallbacks.onReset).toHaveBeenCalledTimes(1);
  });

  test('Raw Manifest コピーボタンのクリップボード呼び出し検証', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const mockResult: C2PaParseResult = {
      status: 'no-credentials',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      manifestStore: null,
    };

    renderApp(container, { type: 'result', result: mockResult, fileName: 'test.jpeg' }, mockCallbacks);

    const copyBtn = container.querySelector('#copy-json-btn') as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();

    copyBtn.click();
    expect(mockWriteText).toHaveBeenCalledWith('null');
  });

  test('追加テスト: no-credentials/unsupported-or-error での Validation 表示検証 / 未検証ステータスでは検証未実施と表示されること', () => {
    const mockResultNoCred: C2PaParseResult = {
      status: 'no-credentials',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      manifestStore: null,
    };
    renderApp(container, { type: 'result', result: mockResultNoCred, fileName: 'test.jpeg' }, mockCallbacks);
    expect(container.textContent).toContain('検証未実施');
    expect(container.textContent).not.toContain('Validation エラーは検出されませんでした。');

    const mockResultError: C2PaParseResult = {
      status: 'unsupported-or-error',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      error: new Error('test error'),
    };
    renderApp(container, { type: 'result', result: mockResultError, fileName: 'test.jpeg' }, mockCallbacks);
    expect(container.textContent).toContain('検証未実施');
    expect(container.textContent).not.toContain('Validation エラーは検出されませんでした。');
  });

  test('追加テスト: execCommand コピー失敗時のエラーハンドリング検証 / fallbackコピー処理が失敗した際にコピー失敗メッセージを表示すること', async () => {
    // navigator.clipboard を無効化
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true
    });

    // document.execCommand を mock
    const originalExecCommand = document.execCommand;
    document.execCommand = vi.fn().mockReturnValue(false);

    const mockResult: C2PaParseResult = {
      status: 'verified',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      manifestStore: { active_manifest: 'test', manifests: {} },
    };

    renderApp(container, { type: 'result', result: mockResult, fileName: 'test.jpeg' }, mockCallbacks);

    const copyBtn = container.querySelector('#copy-json-btn') as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();

    copyBtn.click();

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(copyBtn.textContent).toBe('❌ コピー失敗');

    // リストア
    document.execCommand = originalExecCommand;
  });
});
