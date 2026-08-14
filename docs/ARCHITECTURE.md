# ARCHITECTURE

## 概要

C2PA Viewer は、画像に埋め込まれた C2PA / Content Credentials をブラウザ内だけで
解析・検証して表示する静的 SPA。バックエンド・DB・外部API・画像アップロードは無い。

## 全体構成

```
index.html
  └─ src/main.ts       … エントリポイント。D&D / file input のイベント配線
       ├─ src/c2pa.ts   … @contentauth/c2pa-web 呼び出し（Reader生成・ManifestStore取得）
       ├─ src/parser.ts … ManifestStore → C2PaParseResult（4種判定ロジック）
       ├─ src/copy.ts   … C2PaParseResult → 表示文言（DOM非依存の純粋関数）
       └─ src/ui.ts     … 表示文言 → DOM描画（トップ画面・結果表示・詳細画面・Raw Manifest）
```

## データフロー

```
File取得(D&D/input)
  → isSupportedFormat() で形式チェック（JPEG/PNG/WebP以外は unsupported-or-error）
  → readC2Pa(file)                    [src/c2pa.ts]
      内部で c2pa-web の Reader を生成 → ManifestStore取得 → 必ず解放(try/finally)
  → parseManifestStore(manifestStore) [src/parser.ts]
      → C2PaParseResult（status / claimGenerator / digitalSourceType /
        aiGenerationStatus / validationErrors / assertionsCount / … ）
  → getResultCopy(result)             [src/copy.ts]
      → 表示文言（icon / title / body / warnings / detailFields）
  → ui.ts が DOM に描画
```

**設計原則**: `copy.ts` は DOM に一切依存しない純粋関数。表示文言の安全性
（no-credentials時の必須警告文・verification-issue時の非断定表現）を
DOM無しで単体テストできるようにするため、意図的にロジックを分離している。

## どこを触れば何が変わるか

| 変更したいこと | 触るファイル |
|---|---|
| C2PA判定ロジック（4種ステータスの分岐条件） | `src/parser.ts` |
| 表示文言（タイトル・警告文・断定回避の言い回し） | `src/copy.ts` |
| c2pa-web の呼び出し方（WASM URL・Reader解放等） | `src/c2pa.ts` |
| 画面のマークアップ・レイアウト・折りたたみセクション | `src/ui.ts` |
| デザイントークン（色・タイポグラフィ・スペーシング） | `src/style.css` |
| D&D / file inputのイベント配線 | `src/main.ts` |

## 判定ステータス（C2PaStatus）

- `verified` — C2PAあり、Validationに重大な問題なし
- `verification-issue` — C2PAあり、Validationで問題あり
- `no-credentials` — C2PA Manifestが検出されない
  - **重要原則**: 「AI生成ではない」「人間が作った」ことを一切意味しない。
    C2PA情報が削除された画像や、C2PAを付加せずに作成された画像も該当する。
- `unsupported-or-error` — 未対応フォーマットまたは解析失敗

`AiGenerationStatus`（`is_ai` / `not_ai` / `unknown`）は Digital Source Type
（`c2pa.actions` / `c2pa.actions.v2` の両方を認識）から判定する。情報が無い・
未知の値の場合は `unknown` とし、断定しない。

## 重要な実装上の注意

- **WASM URL**: `@contentauth/c2pa-web` のデフォルト WASM は CDN
  （`jsdelivr` の `dist/resources/c2pa_bg.wasm`）から取得する。バージョンを
  上げる際はファイル名が変わっていないか確認すること（0.13.4→他バージョンで
  実際にファイル名が変わり404になった実績がある）。
- **MIME type**: `File.type` が空文字のブラウザ環境があるため、拡張子から
  MIME typeを解決するフォールバック（`resolveMimeType()`）を持つ。
- **Validation判定**: `validation_status` は `success` フィールドが省略される
  レガシー形式がある。`success !== true` を失敗として扱う（`success === false`
  だけで判定すると省略時の失敗を見逃す）。
- **ネットワーク送信禁止**: `fetch` / `XMLHttpRequest` / `WebSocket` 等で
  画像や解析結果を外部送信するコードを書かない（c2pa-web内部のWASM取得のための
  CDNアクセスのみ許容）。

## テスト

- `src/copy.test.ts` / `src/c2pa.test.ts` / `src/ui.test.ts`（Vitest + jsdom）
- カバレッジ対象は `src/c2pa.ts` / `src/copy.ts` / `src/parser.ts`（`vite.config.ts`
  の `coverage.include`）。表示専用のDOM配線（`ui.ts` / `main.ts`）はカバレッジ
  ゲートの対象外（`rules/testing.md` の「静的コンテンツにテストを作り込まない」方針）。
- `make ci` = lint + test:coverage + build

## 意図的に採用しなかったもの（MVP範囲外）

`README.md` の「やらないこと」参照。将来的な拡張の方向性は
`docs/adr/0001-c2pa-only-mvp-scope.md` を参照。
