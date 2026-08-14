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

/**
 * サポートされている画像フォーマットか確認します
 */
export function isSupportedFormat(mimeType: string, filename?: string): boolean {
  if (SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true;
  }
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return true;
    }
  }
  return false;
}

let defaultReaderFactoryPromise: Promise<ReaderFactory> | null = null;

async function getDefaultReaderFactory(): Promise<ReaderFactory> {
  if (!defaultReaderFactoryPromise) {
    defaultReaderFactoryPromise = (async () => {
      // WASM のパス等の設定はデフォルで init
      const c2pa = await createC2pa({
        wasmSrc: 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.13.4/dist/resources/c2pa.wasm',
      });
      return c2pa.reader;
    })();
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
  const mimeType = blob.type;

  if (!isSupportedFormat(mimeType, blob instanceof File ? blob.name : undefined)) {
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
