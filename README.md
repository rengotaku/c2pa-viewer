# C2PA Viewer

画像ファイルをブラウザにドラッグ＆ドロップすると、画像に埋め込まれた C2PA / Content Credentials を解析・検証して、人間が分かる形で表示する Web ツール。

解析はすべてブラウザ内で完結し、画像をサーバーへ送信しない。

## 特徴

- 🔒 画像は外部送信されない（バックエンド・DB・API なし）
- 対応形式: JPEG / PNG / WebP
- `@contentauth/c2pa-web`（WASM）で Manifest 取得・署名検証
- PC / スマートフォン対応

## 開発

```bash
make install   # 依存インストール (npm ci)
make dev       # 開発サーバー起動
make lint      # ESLint
make test      # テスト実行 (vitest)
make build     # 型チェック + プロダクションビルド
make ci        # lint + test:coverage + build
```

## 構成

```text
src/
├─ main.ts    # エントリポイント
├─ c2pa.ts    # c2pa-web 呼び出し (Reader生成・ManifestStore取得)
├─ parser.ts  # Manifest解析・判定ロジック
├─ ui.ts      # DOM描画
└─ style.css
```

## やらないこと（MVP範囲外）

- AI画像を画像認識で推測する機能
- SynthID / Stable Diffusion系ウォーターマーク検出
- 画像保存・ユーザー登録・履歴保存
- サーバー・DB・API
- 動画・音声解析
