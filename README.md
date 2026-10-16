# 獣界年代記（仮称） / BEASTFOLK CHRONICLES

獣人文明・国家興亡シミュレーション。**P4先行：国家人口・種族能力・武将人事の操作可能なブラウザ試作版**。

## 現在できること

- 4地域・2国家・2獣人タイプの小さな **契約検証用サンプル世界**を作る。
- 同一シードの決定的PRNGを作り、月を進める。
- 国家方針変更、国家人口／種族能力の表示に加え、各地域3人の武将配置、人材登用、転任、年次候補とAI自動人事が動作する。
- 国家滅亡後の敵将が捕虜・亡命・引退となり、捕虜登用を行えるバックエンドを実装（戦争システムとの接続は未着手）。
- 参照整合性・数値範囲・首都・軍団長・外交ペア等を検証する。
- JSONセーブ/ロード、スキーマバージョン検査を行う。
- Node.js標準テストランナーでテストする。

**重要:** サンプル4地域・2国家・2種族・12初期武将。50地域／10国、経済・戦争・国境変化、IndexedDB、iPhone Safari実機監査は**未実装**。武将の登用・交代・年次処理とブラウザUIは実装済み。戦争が起きないのはこの試作段階の制約です。

## 動作確認

```bash
npm run check
npm test
node --input-type=module -e "import {createWorld} from './src/core/world.js'; import {advanceMonth} from './src/core/engine.js'; let w=createWorld(12345); console.log(advanceMonth(w).world.monthIndex)"
```

[ゲームを開く](https://izu48625.github.io/beastfolk-chronicles/) / Node.js >= 20。外部パッケージ、外部API、サーバー、課金不要。GitHub Pagesで静的配信。

## 開発ルール

- 正式契約: [`docs/interfaces.md`](docs/interfaces.md)
- 分担依頼: [`docs/ai-tasks.md`](docs/ai-tasks.md)
- 統合作業: [`docs/integration.md`](docs/integration.md)
- 元の総合仕様: ユーザー指定の「獣界年代記 Ver.1.0（2026-10-16）」
- ソースの担当: AI-0=`src/core/*`、AI-1=地図、AI-2=生態経済、AI-3=戦争外交AI、AI-4=武将歴史、AI-5=UI、AI-6=QA。
- 他のGitHubプロジェクトを変更しないこと。mainへの統合は原則AI-0のみ。

## GitHubとPhase 0の開発状況

- Repository: [izu48625/beastfolk-chronicles](https://github.com/izu48625/beastfolk-chronicles)
- Branch: main（PRで更新、source of truth）。
- Phase 0のエンジンからP0.1人口ビュー、P4先行人事システムへ拡張済み。ゲームUI稼働中。ただし50地域と戦争・国境変化は未実装。
- 武将システムの実装内容: [docs/officer-system-implementation.md](docs/officer-system-implementation.md)。
- 別作品のリポジトリへは一切変更を加えない。

## 開発担当への入り口

1. `docs/interfaces.md` でキー・ID・更新責任を確認。
2. `docs/ai-tasks.md` にあるAI-1〜AI-6の担当、入力・出力・完了条件を確認。
3. `docs/integration.md` のブランチ/PR手順に沿って実装。
4. `npm run check && npm test` でコア契約と再現性を検証。