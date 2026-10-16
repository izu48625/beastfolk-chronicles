# Beastfolk Chronicles / AI-0 共通データ契約 v1（Phase 0）

- 確定日: 2026-10-16
- 状態: **Phase 0 contract freeze**。上位仕様書 Ver.1.0 の設計意図を優先する。
- 正式ソース: `src/core/constants.js`, `src/core/validation.js` とこの文書。矛盾はAI-0が解消するまで各担当で独断変更しない。
- **現状**: サンプル4地域/2国家/2種族。MVPの50/10/20ではない。経済/戦闘/AI/人物交代の実処理は未実装。

## 1. 数値・ID・単位

| 項目 | 型 / 許容範囲 | 単位・扱い |
|---|---|---|
| `seed`, `rngState` | unsigned 32-bit integer, 0..4294967295 | 共有PRNGの完全状態。`Math.random()`禁止 |
| `monthIndex` | nonnegative safe integer | 世界暦0年1月=`0`。年=`floor(monthIndex/12)`、月=`monthIndex%12+1` |
| 8種族能力・5武将能力、士気、補給、治安、安定度 | finite number 0..100 | 基準値、非整数も許す |
| 資源（treasury/food/materials）、経験 | finite number 0..1e12 | 抽象資源単位。NaN/Infinity禁止 |
| 住民・兵数 | integer 0..1e12 | 個体数を人口集団として表現。原則丸めて保持 |
| `birthRate` | number 0..10 | P2で人型文明向け係数を定義（実世界の出生率ではない） |
| 技術 | integer 0..100 | MVPは agriculture/industry/military/medicine |
| RGB | `#RRGGBB` | nation.color |
| 各種ID | 非空文字列、辞書のキーと `object.id` が一致 | 原則 `province_001`,`nation_001`,`officer_001`,`army_001`,`event_000001`,`dog_shiba` |

内部カウンタ `nextIds={event,officer,army,nation,order}` は各 ID の生成元。新国家・武将・軍のIDは再利用しない。ゲーム内識別子に表示名を使わない。行政区の `provinceId` はSVGの `data-province-id` に対応。廃止された国家は歴史参照のため `nations` に `alive:false` で残す（領土を所有不可）。

## 2. WorldState

```js
{
  schemaVersion: 1, seed: 12345, rngState: 12345, monthIndex: 0,
  provinces: Record<ProvinceId, Province>,
  nations: Record<NationId, Nation>,
  species: Record<SpeciesId, Species>,
  officers: Record<OfficerId, Officer>,
  armies: Record<ArmyId, Army>,
  relations: Record<CanonicalPairKey, Relation>,
  events: HistoryEvent[],
  player: {mode:'observer'|'intervention',selectedNationId:null|string,pendingOrders:GameOrder[]},
  nextIds: {event:1, officer:3, army:3, nation:3, order:1}
}
```

`world` は循環参照・Date・Map・Set・function・NaN/Infinityを含まない、JSONシリアライズ可能な単一正本。地域から国家領土数・人口を、軍から兵数を毎回集計する。重複する `nation.population`、`nation.territories`、`army.troopCount` の恒久保存は禁止。

## 3. Species / Ecology（AI-2）

```js
{
 id:'dog_shiba',nameJa:'柴犬族',familyId:'canidae',animalSpeciesId:'domestic_dog',varietyId:'shiba',
 diet:'herbivore'|'carnivore'|'omnivore',
 stats:{dom:55,eco:55,pow:40,def:40,mob:70,rec:85,log:60,dip:50},
 traits:['keen_smell'],
 ecology:{size:35,foodDemand:0.7,lifespan:70,maturityAge:16,birthRate:1,
          preferredBiomes:['forest','plains']}
}
```

MVPに必要な生態パラメーター追加は `docs/interfaces.md` の変更提案をAI-0が承認後に行う。`family -> animal species -> variety -> resolved game stats` のロード時合成はAI-2の責務で、`WorldState.species[id].stats` には解決後の最終値のみ入れる。特性IDの効果は `src/data/traits.js` に集中させる。

## 4. Province / Nation（AI-1地形、AI-2内政、AI-0所有権更新）

```js
Province={id,nameJa,ownerNationId:string|null,neighbors:string[],
 terrain:'plains'|'forest'|'hills'|'mountains'|'wetlands'|'snowfields'|'coast',
 climate:'cold'|'temperate'|'hot'|'arid',
 populationBySpecies:Record<SpeciesId,nonnegative integer>,
 agriculture:number,commerce:number,development:number,fortLevel:integer,
 publicOrder:number,foodPotential:number,materialPotential:number,
 garrisonArmyIds:string[]}
Nation={id,nameJa,color:'#RRGGBB',government:'tribe'|'kingdom'|'republic'|'federation',
 capitalProvinceId:string,rulerOfficerId:string,treasury:number,food:number,
 materials:number,stability:number,
 strategy:'expansion'|'domestic'|'trade'|'defense'|'diplomacy'|'balanced',
 tech:{agriculture:integer,industry:integer,military:integer,medicine:integer},
 foundedMonth:integer,alive:boolean}
```

`Province.neighbors` は無向グラフ: 自己参照/重複/未知IDなし、必ず双方向一致。所有国は生存国またはnull。生存国は少なくとも1地域を持ち、その首都は自領内。首都喪失・全滅は**同一解決ステップ**で整合させる。

## 5. Officer / Army（AI-3 / AI-4）

```js
Officer={id,nameJa,speciesId,nationId:string|null,age:integer,
 role:'ruler'|'general'|'administrator'|'diplomat'|'scout'|'unassigned',
 stats:{martial:number,command:number,intellect:number,administration:number,diplomacy:number},
 traits:string[],loyalty:number,experience:number,alive:boolean}
Army={id,nationId,provinceId,commanderId,troopsBySpecies:Record<SpeciesId,integer>,
 morale:number,supply:number,targetProvinceId:string|null}
```

死亡武将は `alive:false`, `role:'unassigned'` にし、指揮官・君主から除外する。軍団長は同じ生存国家に所属し生存していること。軍は唯一の `province.garrisonArmyIds` に参照され、その `provinceId` と一致する。

**人口会計**: `populationBySpecies` は「非軍人の住民」のみ。徴兵時は人口を減算し `troopsBySpecies` を増やす。除隊は逆操作、損耗は軍人を減らす。種族総人口=民間人口+軍隊人口（必要に応じ統計表示で合算）。民間人口と軍人は同じ対象を二度数えない。兵を国境越えさせる際は `garrisonArmyIds` と軍 `provinceId` を一トランザクションで更新。

## 6. Relation / HistoryEvent

```js
Relation={nationAId,nationBId,score:number,atWar:boolean,allied:boolean,
 tradeAgreement:boolean,truceUntilMonth:integer|null}
HistoryEvent={id,monthIndex:integer,type:string,
 nationIds:string[],provinceIds:string[],officerIds:string[],speciesIds:string[],
 payload:object,summaryJa:string}
```

RelationsはNationIdのUnicode昇順で `nationAId < nationBId`、キー=`nationAId + '|' + nationBId`。双方から同じレコードを見る。`atWar && allied`は禁止。滅亡国家を履歴から物理削除しない。`HistoryEvent` は月昇順、ID一意、参照先IDが存在する。月内の順序はイベント配列の追記順。表示文以外の `payload` に戦闘損耗・新旧領有国等の構造化データを入れる（実装担当Phaseで定義）。

## 7. GameOrder / 命令契約

```js
GameOrder={id:string,issuer:'ai'|'player',nationId:string,
 type:OrderType,targetProvinceId?:string,params:object,submittedMonth:integer}
```

| OrderType | 必須 params / target | 予定担当 | P0動作 |
|---|---|---|---|
| `set_strategy` | `params.strategy:Strategy` | AI-0 (介入足場) | **実装済** |
| `develop_agriculture` | `targetProvinceId` | AI-2 | NOT_IMPLEMENTED |
| `develop_commerce` | `targetProvinceId` | AI-2 | NOT_IMPLEMENTED |
| `fortify` | `targetProvinceId` | AI-2 | NOT_IMPLEMENTED |
| `recruit` | `targetProvinceId`, `params.troopsBySpecies` | AI-3/AI-2 | NOT_IMPLEMENTED |
| `research` | `params.field` (tech key) | AI-2 | NOT_IMPLEMENTED |
| `move_army` | `params.armyId`, `targetProvinceId` | AI-3 | NOT_IMPLEMENTED |
| `declare_war` | `params.targetNationId` | AI-3 | NOT_IMPLEMENTED |
| `attack` | `params.armyId`, `targetProvinceId` | AI-3 | NOT_IMPLEMENTED |
| `offer_peace` | `params.targetNationId` | AI-3 | NOT_IMPLEMENTED |
| `propose_alliance` | `params.targetNationId` | AI-3 | NOT_IMPLEMENTED |
| `trade_agreement` | `params.targetNationId` | AI-3 | NOT_IMPLEMENTED |

`submittedMonth` は提出ターンの `world.monthIndex`。対象国は生存。player発行の場合、介入モードかつ対象国家に一致すること。AIは勝手にworldを変更せず命令提案のみを返す。システム実装後は個別パラメータの完全検証を追加する。未実装命令の黙認・無視は禁止。

競合: **同じ国家・月・管理領域**のプレイヤー命令がAI命令に優先。軍事・内政・外交の別領域は併存。候補の採否は nationId / 優先スコア / 命令ID の安定順で決定し、探索やオブジェクト列挙順に依存させない。P0では `set_strategy` の同種類重複のみ排除するが、同国家・同種類ならリスト順にかかわらずplayerを優先。多領域コマンド上限はP3統合でAI-0が制定する。

## 8. Public functions / ownership

| Function | owner | Input -> Output / 制約 |
|---|---|---|
| `createRng(seed)` | AI-0 | stateful `{nextUint32(),nextFloat(),nextInt(a,b),getState()}`、必ず同シード同結果 |
| `canonicalPairKey(a,b)` | AI-0 | 異なる2国家IDからソート済の一意キー |
| `createWorld(seed,config={scenario:'sample'})` | AI-0 | fresh `WorldState`。P0は sample のみ |
| `cloneWorld(world)` | AI-0 | JSON deep copy。元データ不変 |
| `getNationSummary(world,nationId)` | AI-0 | `{nationId,provinceCount,population,armyCount,troopCount}` |
| `advanceMonth(world,playerOrders=[])` | AI-0 | `{world,events,acceptedOrders,rejectedOrders}`、月+1、入力world非破壊 |
| `validateOrder(world,order)` | AI-0 | `{ok:true}` または `{ok:false,code,reason}` |
| `resolveOrders(world,orders,rng)` | AI-0 (delegates) | `{world,events,acceptedOrders,rejectedOrders}`、引数worldは**エンジン所有作業コピー**に限る |
| `validateWorld(world)` | AI-0 | `{ok, errors:string[]}` |
| `exportSave(world)` / `importSave(text)` | AI-0 | JSON文字列 ⇄ 検証済みfresh WorldState |
| `buildSeedWorld(seed,config,rng)` [P1追加] | AI-1 | 初期50地域・10国の seed 部分データ、**同シード同結果** |
| `simulateEcology(world,context,rng)` [P2] | AI-2 | 生態・収容力補正の更新案（契約詳細はP1統合前に固定） |
| `applyEconomy(world,context,rng)` [P2] | AI-2 | 生産消費、財政、維持費の更新案（同上） |
| `applyPopulation(world,context,rng)` [P2] | AI-2 | 民間人口集団の遷移（同上） |
| `generateNationOrders(world,nationId,rng)` [P3] | AI-3 | 決定的 GameOrder[]、worldへの直接変更禁止 |
| `resolveDiplomacy(world,orders,context,rng)` [P3] | AI-3 | ordered results, HistoryEvent inputs |
| `resolveWarfare(world,orders,context,rng)` [P3] | AI-3 | 軍の移動・損耗と占領提案、実更新は共通解決段階 |
| `updateOfficers(world,context,rng)` [P4] | AI-4 | 年齢・能力・寿命・交代、元状態非破壊を原則 |
| `buildHistoryEvents(world,changes)` [P4] | AI-4 | 事実に紐づく構造化 HistoryEvent[] |

`[P1/P2/P3/P4]` 表記は**予約名**。P0では未作成であり、実装前にAI-0がシグネチャと戻り値の変更案を固定する。各担当AIが契約を勝手に変更しないこと。

## 9. 1ターン順序（統合予約）

1. player命令を検証して収集、AI-3の決定は**まだ実行しない**
2. 季節/地形/天候条件 -> AI-1/AI-2
3. 経済/財政/食糧/維持費 -> AI-2
4. 民間人口/出生/死亡/移住 -> AI-2
5. 各国家のAI命令提案を全件収集 -> AI-3
6. 武将任務と年次加齢 -> AI-4
7. player優先・重複/上限・資源合法性を同じ世界スナップショット基準で確定 -> AI-0
8. 外交解決 -> AI-3
9. 徴兵/行軍/戦闘/占領 -> AI-3 + AI-2 人口控除
10. 滅亡/建国/分裂/首都移転/君主交代 -> AI-0/AI-3/AI-4
11. 実際に起きた状態変更からイベント化 -> AI-4
12. validateWorld -> rngState反映 -> monthIndex++ -> UI通知

P0 `advanceMonth` は 7のうち `set_strategy` のみ、11記録、12のみを行う。順番や乱数消費順の変更は**シード再現性の破壊的変更**なので `docs/development-log.md` に記録する。

## 10. セーブ/再現性

- `rngState` は **PRNGが消費した直後** の状態。複数担当は**渡された同一rngインスタンスだけ**を使用する。
- シミュレーションロジック内部で `Math.random()`,`Date.now()`,`performance.now()`, ネットワーク結果等を判定入力に使わない。
- リロード後は `importSave` -> `createRng(world.rngState)` -> `advanceMonth` と同じ状態遷移。
- セーブ上限暫定: 64MiB文字。過去の全イベントを永続化するが長期ログの圧縮/スナップショット方針はP6で検討。
- `IndexedDB` 自動保存とインポートUIはP5。Phase 0はJSON文字列のみ。
- スキーマ破壊時は `schemaVersion` を増やし、マイグレーション実装がある場合のみ旧版セーブを読み込む。

## 11. 契約の変更手順

1. 担当AIが要件・変更前後のフィールド・影響ファイルを明記してAI-0に提出。
2. AI-0が他担当・互換性・乱数への影響をレビュー。
3. AI-0が `interfaces.md` と `constants.js` を更新。必要なら `schemaVersion` を更新。
4. 契約テストを追加し、該当担当が実装を修正。
5. main統合後、基準HEADを全担当に配布。

**AI-0の承認なしに共有データへ別名フィールドを増やさない。**