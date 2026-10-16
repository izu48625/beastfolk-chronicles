# Development log

## 2026-10-16 / P0 initial package

- 仕様書Ver.1.0をAI-0共通契約v1に変換。
- 4地域・2国家・2種族のP0サンプル（本番50/10/20ではない）を用意。
- PRNG Mulberry32、player優先を明示した合法な国家方針変更命令、コピー型月次進行、状態検証、JSON入出力を構築。
- AI-1〜AI-6の入力/出力/完了条件を `docs/ai-tasks.md` に分離。
- 未実装: 地図SVG、国家AI・経済・戦争・武将交代・IndexedDB・UI・長期試験。
- GitHub repo: izu48625/beastfolk-chronicles (main; feature/phase0-coreでP0を提案)。
- ローカルNode.jsテスト30件合格。GitHub Actions上でのテストは未確認。
