import { describe, test, expect } from 'vitest';
import { getResultCopy } from './copy';
import type { C2PaParseResult } from './parser';

describe('getResultCopy (事前設計テストケース6件)', () => {
  // 1. verified・AI生成明示あり
  test('1. verified・AI生成明示あり', () => {
    const input: C2PaParseResult = {
      status: 'verified',
      aiGenerationStatus: 'is_ai',
      claimGenerator: 'OpenAI / ChatGPT',
      signatureIssuer: 'OpenAI',
      assertionsCount: 2,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);

    expect(copy.title).toContain('見つかりました');

    const fullText = JSON.stringify(copy);
    expect(fullText).toContain('AI生成');
    expect(fullText).toContain('OpenAI');
    expect(fullText).toMatch(/署名Valid|署名が有効|署名：Valid|署名: Valid/);
  });

  // 2. verified・AI生成情報なし
  test('2. verified・AI生成情報なし', () => {
    const input: C2PaParseResult = {
      status: 'verified',
      aiGenerationStatus: 'unknown',
      assertionsCount: 1,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);

    const fullText = JSON.stringify(copy);
    expect(fullText).not.toContain('作成方法');
    expect(fullText).not.toContain('AI生成');
  });

  // 3. no-credentials
  test('3. no-credentials', () => {
    const input: C2PaParseResult = {
      status: 'no-credentials',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);

    const fullText = JSON.stringify(copy);
    expect(fullText).toContain('⚠️ これは『AI生成ではない』という意味ではありません');
    expect(fullText).not.toContain('人間が作った');
  });

  // 4. verification-issue
  test('4. verification-issue', () => {
    const input: C2PaParseResult = {
      status: 'verification-issue',
      validationErrors: ['signature mismatch'],
      assertionsCount: 1,
      ingredientsCount: 0,
      aiGenerationStatus: 'unknown',
    };
    const copy = getResultCopy(input);

    expect(copy.title).toContain('検証上の問題');
    const fullText = JSON.stringify(copy);
    expect(fullText).not.toMatch(/偽物|改ざん確定|捏造/);
    expect(fullText).toContain('可能性があります');
  });

  // 5. unsupported-or-error
  test('5. unsupported-or-error', () => {
    const input: C2PaParseResult = {
      status: 'unsupported-or-error',
      error: new Error('unknown format'),
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);

    const fullText = JSON.stringify(copy);
    expect(fullText).toMatch(/未対応|失敗/);
  });

  // 6. 禁止語の網羅チェック
  test('6. 禁止語の網羅チェック', () => {
    const cases: C2PaParseResult[] = [
      {
        status: 'verified',
        aiGenerationStatus: 'is_ai',
        claimGenerator: 'OpenAI',
        signatureIssuer: 'OpenAI',
        assertionsCount: 1,
        ingredientsCount: 0,
      },
      {
        status: 'verified',
        aiGenerationStatus: 'unknown',
        assertionsCount: 1,
        ingredientsCount: 0,
      },
      {
        status: 'no-credentials',
        aiGenerationStatus: 'unknown',
        assertionsCount: 0,
        ingredientsCount: 0,
      },
      {
        status: 'verification-issue',
        validationErrors: ['signature mismatch'],
        aiGenerationStatus: 'unknown',
        assertionsCount: 1,
        ingredientsCount: 0,
      },
      {
        status: 'unsupported-or-error',
        error: new Error('unknown format'),
        aiGenerationStatus: 'unknown',
        assertionsCount: 0,
        ingredientsCount: 0,
      },
    ];

    const forbiddenRegex = /偽物|改ざん確定|捏造/;
    for (const item of cases) {
      const copy = getResultCopy(item);
      const fullText = JSON.stringify(copy);
      expect(fullText).not.toMatch(forbiddenRegex);
    }
  });
});

describe('getResultCopy (追加境界条件・回帰テストケース)', () => {
  test('追加テスト: verified・not_ai / not_ai時も作成方法欄を出力せず断定を避ける検証', () => {
    const input: C2PaParseResult = {
      status: 'verified',
      aiGenerationStatus: 'not_ai',
      claimGenerator: 'Leica Camera',
      signatureIssuer: 'Leica',
      assertionsCount: 2,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);
    const fullText = JSON.stringify(copy);

    expect(fullText).not.toContain('作成方法');
    expect(fullText).not.toContain('AI生成');
    expect(fullText).not.toContain('人間が作った');
  });

  test('追加テスト: unsupported-or-error・error未設定時 / エラーメッセージが欠落している場合でもクラッシュせずデフォルトメッセージを出力する', () => {
    const input: C2PaParseResult = {
      status: 'unsupported-or-error',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);
    expect(copy.body).toContain('未対応のフォーマット、または解析中にエラーが発生しました。');
  });

  test('追加テスト: verification-issue・validationErrors未指定 / エラー配列が空またはundefinedの際でもフォールバック警告を出力する', () => {
    const input: C2PaParseResult = {
      status: 'verification-issue',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
    };
    const copy = getResultCopy(input);
    expect(copy.warnings).toBeDefined();
    expect(copy.warnings).toContain('検証エラーが検出されました');
  });
});
