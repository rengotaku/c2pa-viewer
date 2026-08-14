import { describe, it, expect, vi } from 'vitest';
import { readC2Pa, isSupportedFormat, _resetDefaultReaderFactory } from './c2pa';
import { parseManifestStore } from './parser';
import type { Reader, ReaderFactory, C2paSdk } from '@contentauth/c2pa-web';
import type { ManifestStore } from '@contentauth/c2pa-types';
import { createC2pa } from '@contentauth/c2pa-web';

vi.mock('@contentauth/c2pa-web', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@contentauth/c2pa-web')>();
  return {
    ...mod,
    createC2pa: vi.fn().mockResolvedValue({
      reader: {
        fromBlob: vi.fn().mockResolvedValue({
          activeLabel: vi.fn().mockResolvedValue('urn:c2pa:123'),
          manifestStore: vi.fn().mockResolvedValue({
            active_manifest: 'urn:c2pa:123',
            manifests: {
              'urn:c2pa:123': {
                claim_generator: 'Default Factory Generator',
              },
            },
          }),
          free: vi.fn().mockResolvedValue(undefined),
        }),
      },
    }),
  };
});

describe('C2PA Core Logic & Parser', () => {
  // 事前設計テストケース 1: C2PAありJPEG（Validation正常）
  it('1. C2PAありJPEG（Validation正常）', async () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Adobe Photoshop/25.0',
          format: 'image/jpeg',
          assertions: [
            {
              label: 'c2pa.actions',
              data: {
                actions: [
                  {
                    action: 'c2pa.edited',
                    digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
                  },
                ],
              },
            },
          ],
          ingredients: [
            { title: 'input.jpg', format: 'image/jpeg' },
          ],
        },
      },
      validation_status: [],
    };

    const mockFree = vi.fn().mockResolvedValue(undefined);
    const mockReader: Reader = {
      activeLabel: vi.fn().mockResolvedValue('urn:c2pa:123'),
      manifestStore: vi.fn().mockResolvedValue(mockManifestStore),
      activeManifest: vi.fn().mockResolvedValue(mockManifestStore.manifests!['urn:c2pa:123']),
      json: vi.fn(),
      crJson: vi.fn(),
      resourceToBytes: vi.fn(),
      free: mockFree,
    };

    const mockReaderFactory: ReaderFactory = {
      fromBlob: vi.fn().mockResolvedValue(mockReader),
      fromBlobFragment: vi.fn(),
    };

    const blob = new Blob(['dummy'], { type: 'image/jpeg' });
    const result = await readC2Pa(blob, { readerFactory: mockReaderFactory });

    expect(result.status).toBe('verified');
    expect(result.claimGenerator).toBe('Adobe Photoshop/25.0');
    expect(result.digitalSourceType).toContain('trainedAlgorithmicMedia');
    expect(result.format).toBe('image/jpeg');
    expect(result.assertionsCount).toBe(1);
    expect(result.ingredientsCount).toBe(1);
    expect(mockFree).toHaveBeenCalledTimes(1);
  });

  // 事前設計テストケース 2: C2PAあり・Digital Source Typeが trainedAlgorithmicMedia
  it('2. C2PAあり・Digital Source Typeが trainedAlgorithmicMedia', async () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Firefly',
          format: 'image/jpeg',
          assertions: [
            {
              label: 'c2pa.actions',
              data: {
                actions: [
                  {
                    action: 'c2pa.created',
                    digitalSourceType: 'trainedAlgorithmicMedia',
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verified');
    expect(result.aiGenerationStatus).toBe('is_ai');
  });

  // 事前設計テストケース 3: C2PAあり・Digital Source Typeが無い/未知
  it('3. C2PAあり・Digital Source Typeが無い/未知', async () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Camera App',
          format: 'image/jpeg',
          assertions: [
            {
              label: 'c2pa.actions',
              data: {
                actions: [
                  {
                    action: 'c2pa.created',
                    digitalSourceType: 'unknownSourceTypeType123',
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verified');
    expect(result.aiGenerationStatus).toBe('unknown');
  });

  // 事前設計テストケース 4: C2PAあり・Validationエラーあり
  it('4. C2PAあり・Validationエラーあり', async () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Test App',
          format: 'image/jpeg',
        },
      },
      validation_status: [
        {
          code: 'assertion.dataHash.mismatch',
          explanation: 'Hash mismatch',
          success: false,
        },
      ],
    };

    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verification-issue');
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors!.length).toBeGreaterThan(0);
  });

  // 事前設計テストケース 5: C2PA Manifestなし（Reader成功・ManifestStoreが空）
  it('5. C2PA Manifestなし（Reader成功・ManifestStoreが空）', async () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: null,
      manifests: {},
    };

    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('no-credentials');
    expect(result.aiGenerationStatus).toBe('unknown');
  });

  // 事前設計テストケース 6: 未対応フォーマット（例: GIF）
  it('6. 未対応フォーマット（例: GIF）', async () => {
    const blob = new Blob(['dummy'], { type: 'image/gif' });
    const result = await readC2Pa(blob);

    expect(result.status).toBe('unsupported-or-error');
    expect(result.error).toBeDefined();
    expect(result.error?.message).toMatch(/unsupported/i);
  });

  // 事前設計テストケース 7: c2pa-web 側で例外発生（壊れたファイル等）
  it('7. c2pa-web 側で例外発生（壊れたファイル等）', async () => {
    const mockFree = vi.fn().mockResolvedValue(undefined);
    const mockReader: Reader = {
      activeLabel: vi.fn(),
      manifestStore: vi.fn().mockRejectedValue(new Error('Corrupted C2PA data')),
      activeManifest: vi.fn(),
      json: vi.fn(),
      crJson: vi.fn(),
      resourceToBytes: vi.fn(),
      free: mockFree,
    };

    const mockReaderFactory: ReaderFactory = {
      fromBlob: vi.fn().mockResolvedValue(mockReader),
      fromBlobFragment: vi.fn(),
    };

    const blob = new Blob(['corrupted'], { type: 'image/jpeg' });
    const result = await readC2Pa(blob, { readerFactory: mockReaderFactory });

    expect(result.status).toBe('unsupported-or-error');
    expect(result.error?.message).toBe('Corrupted C2PA data');
    expect(mockFree).toHaveBeenCalledTimes(1);
  });

  // 事前設計テストケース 8: 複数 Ingredients / Assertions を持つケース
  it('8. 複数 Ingredients / Assertions を持つケース', async () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Multi Asset Tool',
          format: 'image/png',
          assertions: [
            { label: 'assertion1', data: {} },
            { label: 'assertion2', data: {} },
            { label: 'assertion3', data: {} },
          ],
          ingredients: [
            { title: 'ing1.png' },
            { title: 'ing2.png' },
          ],
        },
      },
    };

    const result = parseManifestStore(mockManifestStore);
    expect(result.assertionsCount).toBe(3);
    expect(result.ingredientsCount).toBe(2);
  });

  // --- 追加テストケース (カバレッジ網羅・境界値テスト) ---

  it('追加テスト: isSupportedFormat-file-extension / MIMEタイプが空で拡張子がjpg/pngの場合の判定', () => {
    expect(isSupportedFormat('', 'sample.jpg')).toBe(true);
    expect(isSupportedFormat('', 'sample.PNG')).toBe(true);
    expect(isSupportedFormat('', 'sample.webp')).toBe(true);
    expect(isSupportedFormat('', 'sample.bmp')).toBe(false);
  });

  it('追加テスト: parseManifestStore-missing-active-manifest / active_manifestがmanifestsに存在しない場合', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:missing',
      manifests: {
        'urn:c2pa:other': {
          claim_generator: 'Other App',
        },
      },
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('no-credentials');
  });

  it('追加テスト: parseManifestStore-claim-generator-info / claim_generatorが空でclaim_generator_infoのみが存在する場合', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator_info: [{ name: 'Info Generator App' }],
          signature_info: {
            issuer: 'Test Authority',
          },
        },
      },
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.claimGenerator).toBe('Info Generator App');
    expect(result.signatureIssuer).toBe('Test Authority');
  });

  it('追加テスト: parseManifestStore-digital-source-type-assertion / c2pa.digital-source-typeアサーションからのデジタルソースタイプ抽出', () => {
    const mockManifestStore1: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          assertions: [
            {
              label: 'c2pa.digital-source-type',
              data: 'trainedAlgorithmicMedia',
            },
          ],
        },
      },
    };
    const result1 = parseManifestStore(mockManifestStore1);
    expect(result1.digitalSourceType).toBe('trainedAlgorithmicMedia');
    expect(result1.aiGenerationStatus).toBe('is_ai');

    const mockManifestStore2: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          assertions: [
            {
              label: 'c2pa.digital-source-type',
              data: { digitalSourceType: 'trainedAlgorithmicMedia' },
            },
          ],
        },
      },
    };
    const result2 = parseManifestStore(mockManifestStore2);
    expect(result2.digitalSourceType).toBe('trainedAlgorithmicMedia');
    expect(result2.aiGenerationStatus).toBe('is_ai');
  });

  it('追加テスト: parseManifestStore-validation-results-failure / validation_results.activeManifest.failureが存在する場合', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {},
      },
      validation_results: {
        activeManifest: {
          success: [],
          informational: [],
          failure: [{ code: 'signature.untrusted' }],
        },
      },
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verification-issue');
    expect(result.validationErrors).toContain('signature.untrusted');
  });

  it('追加テスト: parseManifestStore-validation-state-invalid / validation_stateがInvalidの場合', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {},
      },
      validation_state: 'Invalid',
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verification-issue');
  });

  it('追加テスト: readC2Pa-null-reader / ReaderFactoryからnullが返る場合', async () => {
    const mockReaderFactory: ReaderFactory = {
      fromBlob: vi.fn().mockResolvedValue(null),
      fromBlobFragment: vi.fn(),
    };

    const blob = new Blob(['dummy'], { type: 'image/jpeg' });
    const result = await readC2Pa(blob, { readerFactory: mockReaderFactory });

    expect(result.status).toBe('no-credentials');
  });

  it('追加テスト: readC2Pa-default-reader-factory / options未指定時にgetDefaultReaderFactoryが参照されるケース', async () => {
    const blob = new Blob(['dummy'], { type: 'image/jpeg' });
    const result = await readC2Pa(blob);

    expect(result.status).toBe('verified');
    expect(result.claimGenerator).toBe('Default Factory Generator');
    expect(createC2pa).toHaveBeenCalledWith(
      expect.objectContaining({
        wasmSrc: 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.13.4/dist/resources/c2pa_bg.wasm',
      })
    );
  });

  // --- codex レビュー指摘対応の追加テストケース ---

  it('追加テスト: parseManifestStore-validation-status-success-mix / success:trueな成功項目が混在する場合でもsuccess:falseが無い限りverifiedと判定される', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Validated App',
        },
      },
      validation_status: [
        {
          code: 'claim.signature.validated',
          explanation: 'Signature is valid',
          success: true,
        },
        {
          code: 'assertion.hashed_extents.validated',
          explanation: 'Extents match',
          success: true,
        },
      ],
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verified');
    expect(result.validationErrors).toBeUndefined();
  });

  it('追加テスト: parseManifestStore-actions-v2-label / c2pa.actions.v2ラベルからActionsおよびdigitalSourceTypeが認識・抽出される', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          assertions: [
            {
              label: 'c2pa.actions.v2',
              data: {
                actions: [
                  {
                    action: 'c2pa.edited',
                    digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
                  },
                ],
              },
            },
          ],
        },
      },
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.actions).toBeDefined();
    expect(result.actions?.length).toBe(1);
    expect(result.digitalSourceType).toBe('http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture');
  });

  it('追加テスト: parseManifestStore-not-ai-types / digitalCapture等の既知非AIタイプのDigital Source Typeでnot_aiと判定される', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          assertions: [
            {
              label: 'c2pa.actions',
              data: {
                actions: [
                  {
                    action: 'c2pa.created',
                    digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
                  },
                ],
              },
            },
          ],
        },
      },
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verified');
    expect(result.aiGenerationStatus).toBe('not_ai');
  });

  // --- codex 再レビュー指摘対応の追加テストケース ---

  it('追加テスト: parseManifestStore-legacy-validation-status-omitted-success / successフィールドが省略されたレガシー失敗項目(v.success === undefined)でverification-issueと判定される', () => {
    const mockManifestStore: ManifestStore = {
      active_manifest: 'urn:c2pa:123',
      manifests: {
        'urn:c2pa:123': {
          claim_generator: 'Legacy App',
        },
      },
      validation_status: [
        {
          code: 'claim.signature.mismatch',
          explanation: 'Signature invalid',
          // success field is omitted (undefined)
        },
      ],
    };
    const result = parseManifestStore(mockManifestStore);
    expect(result.status).toBe('verification-issue');
    expect(result.validationErrors).toContain('Signature invalid');
  });

  it('追加テスト: readC2Pa-default-reader-factory-rejection-reset / getDefaultReaderFactoryで初期化エラー発生時にプロミスキャッシュがリセットされ次回呼び出しで再試行可能になる', async () => {
    _resetDefaultReaderFactory();
    const createC2paMock = vi.mocked(createC2pa);
    createC2paMock.mockRejectedValueOnce(new Error('WASM load failed 404'));

    const blob = new Blob(['dummy'], { type: 'image/jpeg' });
    const result1 = await readC2Pa(blob);
    expect(result1.status).toBe('unsupported-or-error');
    expect(result1.error?.message).toBe('WASM load failed 404');

    // 次回呼び出しで再試行され、正常レスポンスを返す
    createC2paMock.mockResolvedValueOnce({
      reader: {
        fromBlob: vi.fn().mockResolvedValue({
          activeLabel: vi.fn().mockResolvedValue('urn:c2pa:123'),
          manifestStore: vi.fn().mockResolvedValue({
            active_manifest: 'urn:c2pa:123',
            manifests: {
              'urn:c2pa:123': {
                claim_generator: 'Retried Reader App',
              },
            },
          }),
          free: vi.fn().mockResolvedValue(undefined),
        }),
      },
    } as unknown as C2paSdk);

    const result2 = await readC2Pa(blob);
    expect(result2.status).toBe('verified');
    expect(result2.claimGenerator).toBe('Retried Reader App');
  });
});
