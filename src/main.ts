import './style.css'

// エントリポイント（scaffold時点）。
// UI/C2PA解析ロジックは後続の実装Issueで src/c2pa.ts, src/parser.ts, src/ui.ts に実装する。
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <h1>C2PA Viewer</h1>
    <p>準備中です。</p>
  </main>
`
