# AI-0 統合手順 / Phase 0 -> Phase 6

1. 新規GitHubリポジトリ `beastfolk-chronicles` を用意（**別作品リポジトリは使わない**）。初回ソースをmainへ登録。公開/非公開はユーザーの選択に従う。無料プランで足りる構成。
2. `npm run check && npm test` をベースライン確認。`docs/interfaces.md` はAI-0だけが改定。
3. 必要に応じて担当ブランチを作成: AI-1=`feature/world-map`, AI-2=`feature/ecology-economy`, AI-3=`feature/military-ai`, AI-4=`feature/officers-history`, AI-5=`feature/ui-mobile`, AI-6=`test/long-run-qa`。
4. 担当AIはmainの基準SHAと契約を確認、担当ファイルだけを編集、単体テストを追加/実行する。クロスファイル差分が必要ならAI-0が引き取る。
5. 各PRに「基準SHA・編集ファイル・関数契約・テスト・既知の問題」を添付する。AI-0が依存/契約/セーブ互換性/乱数消費順をレビュー。
6. 先行統合優先度: P1 map seed -> P2 species/economy -> P3 warfare/AI -> P4 officers/history -> P5 mobile/DB storage -> P6 QA。
7. `src/core/engine.js` の呼出順を更新するのはAI-0だけ。UIから直接戦闘・国庫・領土を変更しない。
8. `validateWorld` と `npm test` を通し、サンプルと50地域の初期化・15,000 simulation-yearsのテストが追加されたかを検証する。
9. mainへ反映したらHEADを全担当に再配布。公開時はPages/無料静的ホストのURLを確認。PR・コミット・公開URLを作成/確認できないなら「未作成」と報告。

## PRマージ前チェック

- [ ] contracts.mdではなく `docs/interfaces.md` の記述と一致
- [ ] 無断で他担当のソースを変更していない
- [ ] `Math.random()`, 非決定的時刻/通信をエンジンが使っていない
- [ ] 不正な命令が拒否される
- [ ] 同一seed・同一操作で完全一致
- [ ] save -> import -> 進行の同一性
- [ ] 生存国の首都と君主、地域の隣接、軍団長と軍団の参照が有効
- [ ] iPhone Safariの操作・中断を実機確認（P5以降）
- [ ] 未実装事項やテスト未実施を完了として扱わない
