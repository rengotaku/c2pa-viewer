---
adr: 0001
title: C2PA解析専用MVP・vanilla TS+Vite・no-credentials非断定の3方針
status: accepted
superseded_by: null
date: 2026-08-14
issues: [1, 2, 3]
tags: [c2pa, scaffold, scope, ui-copy]
description: C2PA検出のみに絞ったMVPスコープ、React不使用のvanilla TS+Vite構成、no-credentialsを「AI生成ではない」と誤読させない文言方針を採用した
---

# ADR 0001: C2PA解析専用MVP・vanilla TS+Vite・no-credentials非断定の3方針

## 背景

C2PA Viewerは「この画像にはC2PA情報が入っているのか？誰が、何を使って作った画像なのか？」
に数秒で答えるツールとして企画された。実装開始時に以下3点の方針判断が必要だった。

## 決定

### 1. スコープはC2PA検出のみ（AI画像判定器にしない）

MVPでは C2PA Manifest の解析・検証結果表示のみを行う。以下は明示的に対象外とする:
- AI画像を画像認識で推測する機能
- SynthID / Stable Diffusion系ウォーターマーク検出
- EXIF等C2PA以外のメタデータ解析
- 画像保存・ユーザー登録・履歴保存・サーバー・DB・API

### 2. 技術構成はVite + TypeScript（Reactなし）、my-boilerplateテンプレートは不使用

`rengotaku/my-boilerplate` には `go-cli` / `go-ssr-web` / `go-react-spa` / `react-spa` 等の
テンプレートがあるが、いずれもReactまたはGoバックエンドを前提とする。本ツールは
「バックエンドなし・フレームワークなし」が要件として明示されていたため、Vite公式の
`vanilla-ts` テンプレートを直接scaffoldした（`NEW_REPO_BYPASS=1` でガードを明示的に回避）。

### 3. `no-credentials` は「AI生成ではない」「人間が作った」を一切意味しない

C2PA Manifestが検出されない場合、UI・型定義・コメントの全レベルで
「これはAI生成ではないという意味ではありません」という警告を必ず表示し、
逆方向の誤解（no-credentials = 人間作成）を防ぐ。これはツールの信頼性を左右する
中核原則として、`src/parser.ts` の型コメントと `src/copy.ts` のテストケース
（禁止語チェック含む）の両方で担保している。

### 4. 表示文言生成をDOM非依存の純粋関数として分離

`src/copy.ts`（`getResultCopy()`）をDOM操作から分離し、文言の安全性
（no-credentials必須警告・verification-issueの非断定表現）をDOM無しで
単体テストできる構成にした。`ui.ts` はこの純粋関数の戻り値を描画するだけ。

## 捨てた案

- **`@contentauth/c2pa-web/inline`（WASMをJSバンドルに埋め込む）**: バンドルサイズが
  大きくなるため、MVPでは通常版（CDNからWASM取得）を採用。将来的な検討事項として残す。
- **React（`react-spa`テンプレート）**: 状態管理の複雑さに対してオーバースペックであり、
  「ReactもMVPでは必須ではない」という要件と矛盾するため不採用。
- **`ui.ts`にDOM描画と文言生成を混在させる案**: テスト容易性のため分離した（上記決定4）。

## 変えてよい前提 / 壊すと危ない前提

- **変えてよい**: WASM配信方式（CDN→inline化）、対応フォーマットの追加（GIF等）、
  スタイリング（デザイントークン・レイアウト）、依存ライブラリのバージョン
  （ただしWASMファイル名の実在確認は必須。ARCHITECTURE.md参照）
- **壊すと危ない**: 「no-credentials ≠ AI生成ではない」の原則を崩す表示・文言変更。
  `src/copy.ts` の禁止語チェックテスト（「偽物」「改ざん確定」等の断定表現の禁止）を
  無効化・削除すること。画像・解析結果をサーバーへ送信するコードの追加。
