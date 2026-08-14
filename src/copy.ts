import type { C2PaParseResult } from './parser';

export interface DetailField {
  label: string;
  value: string;
}

export interface ResultCopy {
  icon: string;
  title: string;
  body: string;
  warnings?: string[];
  detailFields?: DetailField[];
}

export function getResultCopy(result: C2PaParseResult): ResultCopy {
  switch (result.status) {
    case 'verified': {
      const detailFields: DetailField[] = [];

      if (result.aiGenerationStatus === 'is_ai') {
        detailFields.push({ label: '作成方法', value: 'AI生成' });
      }

      detailFields.push({
        label: '発行元',
        value: result.signatureIssuer || '不明',
      });

      detailFields.push({
        label: '作成ツール',
        value: result.claimGenerator || '不明',
      });

      detailFields.push({
        label: '署名ステータス',
        value: '署名Valid',
      });

      return {
        icon: '✓',
        title: '✓ Content Credentials が見つかりました',
        body: '画像に改ざんは検出されず、適切な署名が確認されました。',
        detailFields,
      };
    }

    case 'no-credentials': {
      return {
        icon: '○',
        title: '○ Content Credentialsは見つかりませんでした',
        body: 'この画像には Content Credentials データが含まれていません。\n⚠️ これは『AI生成ではない』という意味ではありません。',
        warnings: [
          '⚠️ これは『AI生成ではない』という意味ではありません',
        ],
      };
    }

    case 'verification-issue': {
      const errors = result.validationErrors || [];
      return {
        icon: '⚠',
        title: '⚠ 検証上の問題があります',
        body: 'この画像は、署名された状態から変更されている可能性があります。',
        warnings: errors.length > 0 ? errors : ['検証エラーが検出されました'],
      };
    }

    case 'unsupported-or-error': {
      const errorMessage = result.error?.message || '未対応のフォーマット、または解析中にエラーが発生しました。';
      return {
        icon: '×',
        title: '× 未対応形式または解析に失敗しました',
        body: errorMessage,
      };
    }

    default: {
      return {
        icon: '×',
        title: '× 未対応形式または解析に失敗しました',
        body: '不明な解析ステータスです。',
      };
    }
  }
}
