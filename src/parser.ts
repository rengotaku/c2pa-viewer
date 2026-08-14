import type { ManifestStore, Manifest } from '@contentauth/c2pa-types';

/**
 * C2PA解析・判定ステータス
 *
 * 【重要原則】
 * 'no-credentials' は C2PA Manifest が検出されないことを意味し、
 * 「AI生成ではない」「人間が作った」という意味を一切持ちません。
 * C2PA情報が削除された画像や、C2PAを付加せずに作成された画像も no-credentials になります。
 */
export type C2PaStatus =
  | 'verified'
  | 'verification-issue'
  | 'no-credentials'
  | 'unsupported-or-error';

/**
 * AI生成判定ステータス
 *
 * - 'is_ai': C2PAデータ(digitalSourceType等)により明確にAI生成と示されている
 * - 'not_ai': C2PAデータにより明確にキャプチャ・非AIとして示されている
 * - 'unknown': digitalSourceType等の情報がない、または未知の値のため判定不可
 */
export type AiGenerationStatus = 'is_ai' | 'not_ai' | 'unknown';

export interface C2PaActionInfo {
  action: string;
  digitalSourceType?: string;
  [key: string]: unknown;
}

export interface C2PaParseResult {
  /** 判定ステータス */
  status: C2PaStatus;
  /** Claim Generator (システム/ツール名) */
  claimGenerator?: string | null;
  /** Digital Source Type */
  digitalSourceType?: string | null;
  /** AI生成判定 (is_ai | not_ai | unknown) */
  aiGenerationStatus: AiGenerationStatus;
  /** 画像フォーマット (MIME Type) */
  format?: string | null;
  /** Signature Issuer (証明書発行元等) */
  signatureIssuer?: string | null;
  /** Validation エラーメッセージ一覧 */
  validationErrors?: string[];
  /** Assertions 件数 */
  assertionsCount: number;
  /** Ingredients 件数 */
  ingredientsCount: number;
  /** Actions 一覧 */
  actions?: C2PaActionInfo[];
  /** 解析エラー (unsupported-or-error 時) */
  error?: Error | null;
  /** アクティブ Manifest raw データ */
  activeManifest?: Manifest | null;
  /** ManifestStore raw データ */
  manifestStore?: ManifestStore | null;
}

const AI_DIGITAL_SOURCE_TYPES = [
  'trainedalgorithmicmedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicmedia',
];

const NON_AI_DIGITAL_SOURCE_TYPES = [
  'digitalcapture',
  'negativefilm',
  'positivefilm',
  'minorhumanedits',
  'screencapture',
  'print',
];

/**
 * ManifestStore を解析し、C2PA情報・判定ステータスを返します。
 */
export function parseManifestStore(manifestStore: ManifestStore | null | undefined): C2PaParseResult {
  if (!manifestStore || !manifestStore.active_manifest || !manifestStore.manifests) {
    return {
      status: 'no-credentials',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      manifestStore: manifestStore || null,
    };
  }

  const activeLabel = manifestStore.active_manifest;
  const activeManifest = manifestStore.manifests[activeLabel];

  if (!activeManifest) {
    return {
      status: 'no-credentials',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      manifestStore,
    };
  }

  // Validation Status / Issue の収集
  const validationErrors: string[] = [];

  if (Array.isArray(manifestStore.validation_status)) {
    for (const v of manifestStore.validation_status) {
      if (v && v.success === false) {
        validationErrors.push(v.explanation || v.code || 'Validation error');
      }
    }
  }

  if (manifestStore.validation_results?.activeManifest?.failure) {
    for (const f of manifestStore.validation_results.activeManifest.failure) {
      if (f) {
        validationErrors.push(f.explanation || f.code || 'Validation failure');
      }
    }
  }

  if (manifestStore.validation_state === 'Invalid') {
    if (validationErrors.length === 0) {
      validationErrors.push('Manifest store validation state is Invalid');
    }
  }

  const hasValidationIssue = validationErrors.length > 0;
  const status: C2PaStatus = hasValidationIssue ? 'verification-issue' : 'verified';

  // 基本フィールド
  const claimGenerator =
    activeManifest.claim_generator ||
    (activeManifest.claim_generator_info && activeManifest.claim_generator_info[0]?.name) ||
    null;
  const format = activeManifest.format || null;
  const signatureIssuer =
    activeManifest.signature_info?.issuer ||
    activeManifest.signature_info?.common_name ||
    null;

  const assertionsCount = activeManifest.assertions?.length || 0;
  const ingredientsCount = activeManifest.ingredients?.length || 0;

  // Actions & Digital Source Type の解析
  const extractedActions: C2PaActionInfo[] = [];
  let extractedDigitalSourceType: string | null = null;

  if (activeManifest.assertions) {
    for (const assertion of activeManifest.assertions) {
      if ((assertion.label === 'c2pa.actions' || assertion.label === 'c2pa.actions.v2' || assertion.label.startsWith('c2pa.actions.')) && assertion.data) {
        const dataObj = assertion.data as { actions?: C2PaActionInfo[] };
        if (Array.isArray(dataObj.actions)) {
          for (const act of dataObj.actions) {
            extractedActions.push(act);
            if (act.digitalSourceType && !extractedDigitalSourceType) {
              extractedDigitalSourceType = act.digitalSourceType;
            }
          }
        }
      } else if (
        (assertion.label === 'c2pa.digital-source-type' || assertion.label.includes('digital-source-type')) &&
        assertion.data
      ) {
        if (typeof assertion.data === 'string') {
          extractedDigitalSourceType = assertion.data;
        } else if (typeof assertion.data === 'object' && assertion.data !== null) {
          const dsData = assertion.data as { digitalSourceType?: string };
          if (dsData.digitalSourceType) {
            extractedDigitalSourceType = dsData.digitalSourceType;
          }
        }
      }
    }
  }

  // AI生成判定
  let aiGenerationStatus: AiGenerationStatus = 'unknown';

  if (extractedDigitalSourceType) {
    const lowerDs = extractedDigitalSourceType.toLowerCase();
    const isAi = AI_DIGITAL_SOURCE_TYPES.some((term) => lowerDs.includes(term.toLowerCase()));
    const isNotAi = NON_AI_DIGITAL_SOURCE_TYPES.some((term) => lowerDs.includes(term.toLowerCase()));

    if (isAi) {
      aiGenerationStatus = 'is_ai';
    } else if (isNotAi) {
      aiGenerationStatus = 'not_ai';
    } else {
      // 未知のType
      aiGenerationStatus = 'unknown';
    }
  }

  return {
    status,
    claimGenerator,
    digitalSourceType: extractedDigitalSourceType,
    aiGenerationStatus,
    format,
    signatureIssuer,
    validationErrors: hasValidationIssue ? validationErrors : undefined,
    assertionsCount,
    ingredientsCount,
    actions: extractedActions.length > 0 ? extractedActions : undefined,
    activeManifest,
    manifestStore,
  };
}
