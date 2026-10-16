# 獣界年代記（仮称） / BEASTFOLK CHRONICLES

獣人文明・国家興亡シミュレーション。**Phase 0 / engine-contract scaffold only**.

## 現在できること

- 4地域・2国家・2獣人タイプの小さな **契約検証用サンプル世界**を作る。
- 同一シードの決定的PRNGを作り、月を進める。
- `set_strategy`（国家方針変更）を検証・適用し、実イベントとして記録する。
- 参照整合性・数値範囲・首都・軍団長・外交ペア等を検証する。
- JSONセーブ/ロード、スキーマバージョン検査を行う。
- Node.js標準テストランナーでテストする。

**重要:** 地図50地域、国家AI、内政、戦闘、国境変化、武将交代、iPhone UI、IndexedDBは**未実装**。何も戦争が起きないのはP0では仕様通りです。

## 動作確認

```bash
npm run check
npm test
node --input-type=module -e "import {createWorld} from './src/core/world.js'; import {advanceMonth} from './src/core/engine.js'; let w=createWorld(12345); console.log(advanceMonth(w).world.monthIndex)"
```

Node.js >= 20。外部パッケージ、外部API、サーバー、課金不要。将来のフロントは GitHub Pages 等の静的配信を想定。

## 開発ルール

- 正式契約: [`docs/interfaces.md`](docs/interfaces.md)
- 分担依頼: [`docs/ai-tasks.md`](docs/ai-tasks.md)
- 統合作業: [`docs/integration.md`](docs/integration.md)
- 元の総合仕様: ユーザー指定の「獣界年代記 Ver.1.0（2026-10-16）」
- ソースの担当: AI-0=`src/core/*`、AI-1=地図、AI-2=生態経済、AI-3=戦争外交AI、AI-4=武将歴史、AI-5=UI、AI-6=QA。
- 他のGitHubプロジェクトを変更しないこと。mainへの統合は原則AI-0のみ。

## GitHubについて

`beastfolk-chronicles` リポジトリはこのパッケージによって自動作成されません。新規リポジトリの所有者・公開URLは作成後に確定してください。既存の別作品のリポジトリに本コードをプッシュしないでください。