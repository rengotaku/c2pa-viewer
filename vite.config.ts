import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // scaffold時点ではテストファイルが無いため許容する。
    // 実装Issueでテストが追加された後は自然に本来のカバレッジ判定に切り替わる。
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      // 分岐を持つロジック(C2PA解析・判定)のみをカバレッジ対象にする。
      // UIマウント処理(main.ts)や表示専用コードは対象外。
      include: ['src/c2pa.ts', 'src/parser.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
})
