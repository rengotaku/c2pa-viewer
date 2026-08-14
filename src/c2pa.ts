import { createC2pa, type Reader, type ReaderFactory } from '@contentauth/c2pa-web';
import { parseManifestStore, type C2PaParseResult } from './parser';

export interface ReadC2PaOptions {
  /** テスト時やカスタム設定用の ReaderFactory */
  readerFactory?: ReaderFactory;
}

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const EXTENSION_TO_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * MIME type またはファイル拡張子から正当な MIME type を解決します
 */
export function resolveMimeType(mimeType: string, filename?: string): string {
  if (mimeType && SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType;
  }
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && EXTENSION_TO_MIME_MAP[ext]) {
      return EXTENSION_TO_MIME_MAP[ext];
    }
  }
  return mimeType;
}

/**
 * サポートされている画像フォーマットか確認します
 */
export function isSupportedFormat(mimeType: string, filename?: string): boolean {
  const resolved = resolveMimeType(mimeType, filename);
  if (SUPPORTED_MIME_TYPES.has(resolved.toLowerCase())) {
    return true;
  }
  return false;
}

let defaultReaderFactoryPromise: Promise<ReaderFactory> | null = null;

/** @internal テスト等でのキャッシュクリア用 */
export function _resetDefaultReaderFactory(): void {
  defaultReaderFactoryPromise = null;
}

async function getDefaultReaderFactory(): Promise<ReaderFactory> {
  if (!defaultReaderFactoryPromise) {
    defaultReaderFactoryPromise = (async () => {
      // WASM のパス等の設定はデフォルで init
      const c2pa = await createC2pa({
        wasmSrc: 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.13.4/dist/resources/c2pa_bg.wasm',
      });
      return c2pa.reader;
    })().catch((err) => {
      defaultReaderFactoryPromise = null;
      throw err;
    });
  }
  return defaultReaderFactoryPromise;
}

/**
 * 画像 File / Blob を読み込んで C2PA 情報を解析します。
 * Reader のメモリ解放(free)は成功・失敗時を問わず確実に行われます。
 */
export async function readC2Pa(
  blob: Blob,
  options?: ReadC2PaOptions
): Promise<C2PaParseResult> {
  const filename = blob instanceof File ? blob.name : undefined;
  const mimeType = resolveMimeType(blob.type, filename);

  if (!isSupportedFormat(mimeType, filename)) {
    return {
      status: 'unsupported-or-error',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      error: new Error(`Unsupported image format: ${mimeType || 'unknown'}`),
    };
  }

  let reader: Reader | null = null;

  try {
    const factory = options?.readerFactory || (await getDefaultReaderFactory());
    reader = await factory.fromBlob(mimeType, blob);

    if (!reader) {
      return parseManifestStore(null);
    }

    const manifestStore = await reader.manifestStore();
    return parseManifestStore(manifestStore);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      status: 'unsupported-or-error',
      aiGenerationStatus: 'unknown',
      assertionsCount: 0,
      ingredientsCount: 0,
      error,
    };
  } finally {
    if (reader && typeof reader.free === 'function') {
      try {
        await reader.free();
      } catch {
        // free失敗時のセーフティ
      }
    }
  }
}
