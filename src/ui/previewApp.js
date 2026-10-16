// Phase 0 browser preview. Uses the real deterministic core; no fake combat/economy.
import {createWorld, cloneWorld, getNationSummary, totalPopulation, totalTroops} from '../core/world.js';
import {advanceMonth} from '../core/engine.js';
import {exportSave, importSave} from '../core/save.js';

const $ = id => document.getElementById(id);
const nfmt = value => new Intl.NumberFormat('ja-JP').format(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const strategies = {balanced:'均衡重視',expansion:'拡張重視',domestic:'内政重視',trade:'商業重視',defense:'防衛重視',diplomacy:'外交重視'};
const terrainNames = {plains:'平原',forest:'森林',hills:'丘陵',mountains:'山岳',wetlands:'湿地',snowfields:'雪原',coast:'沿岸'};
const govNames = {kingdom:'王国',federation:'連邦',republic:'共和国',tribe:'部族'};
const storageKey = 'beastfolk-p0-preview-v1';
let world;
let selectedProvince = 'province_001';
let selectedTab = 'region';
let speed = 0;
let timer = null;

function notify(message, isError = false) {
  $('status').textContent = message;
  $('status').style.color = isError ? '#f4a8a0' : '#9ccbb8';
}
function saveBrowser() {
  try { localStorage.setItem(storageKey, exportSave(world)); }
  catch { /* Safari private browsing may prohibit localStorage. JSON download stays available. */ }
}
function restoreWorld() {
  try {
    const candidate = localStorage.getItem(storageKey);
    if (candidate) return importSave(candidate);
  } catch { /* invalid or unavailable storage */ }
  return createWorld(12345);
}
function allNations() { return Object.values(world.nations).filter(n => n.alive); }
function armyInProvince(prov) {
  return prov.garrisonArmyIds.map(id => world.armies[id]).filter(Boolean);
}
function regionInfo() {
  const prov = world.provinces[selectedProvince] ?? Object.values(world.provinces)[0];
  if (!prov) return '<p>表示可能な地域がありません。</p>';
  const nation = world.nations[prov.ownerNationId];
  const troops = armyInProvince(prov).reduce((sum, army) => sum + totalTroops(army), 0);
  const population = totalPopulation(prov);
  const mainSpecies = Object.entries(prov.populationBySpecies).sort((a,b) => b[1]-a[1])[0];
  const sp = mainSpecies ? world.species[mainSpecies[0]] : null;
  let rows = '';
  const info = [
    ['領有国',nation?.nameJa ?? '中立'],
    ['地形',terrainNames[prov.terrain] ?? prov.terrain],
    ['主要種族',sp?.nameJa ?? '不明'],
    ['開発度',nfmt(prov.development)],
    ['城レベル',nfmt(prov.fortLevel)],
    ['治安',nfmt(prov.publicOrder) + '/100'],
    ['隣接地域',prov.neighbors.map(id => world.provinces[id]?.nameJa || id).join('・')],
  ];
  for (const [key,value] of info) rows += '<div class="info-row"><span>' + esc(key) + '</span><b>' + esc(value) + '</b></div>';
  return '<div class="kicker">PROVINCE / REGION</div><h3>' + esc(prov.nameJa) + '</h3>' +
    '<span class="tag">' + esc(nation?.nameJa ?? '中立') + '</span>' +
    '<div class="stats"><div class="stat"><span>住民人口</span><strong>' + nfmt(population) + '</strong></div><div class="stat"><span>駐留兵数</span><strong>' + nfmt(troops) + '</strong></div></div>' + rows +
    '<div class="notice">この地図はPhase 0の接続試験用です。国境を動かす戦闘はPhase 3で実装予定。</div>';
}
function nationInfo() {
  let html = '<div class="kicker">NATIONS / 国家一覧</div><h3>勢力と国力</h3>';
  for (const nation of allNations()) {
    const s = getNationSummary(world,nation.id);
    const ruler = world.officers[nation.rulerOfficerId];
    html += '<button class="mini-row" data-nation="' + esc(nation.id) + '"><div>' +
      '<strong><span class="dot" style="background:' + esc(nation.color) + '"></span>' + esc(nation.nameJa) + '</strong><br><small>君主: ' + esc(ruler?.nameJa ?? '不明') + ' / ' + esc(strategies[nation.strategy] ?? nation.strategy) + '</small>' +
      '</div><div style="text-align:right"><strong>' + nfmt(s.provinceCount) + '地域</strong><br><small>人口 ' + nfmt(s.population) + '</small></div></button>';
  }
  const worldPeople = Object.values(world.provinces).reduce((sum,p) => sum + totalPopulation(p),0);
  html += '<div class="notice">現在の世界人口（民間）: ' + nfmt(worldPeople) + '。住民と兵士は別々に集計しています。</div>';
  return html;
}
function officersInfo() {
  let html = '<div class="kicker">OFFICERS / 武将名鑑</div><h3>現役武将</h3>';
  for (const officer of Object.values(world.officers).filter(o => o.alive)) {
    const nation = world.nations[officer.nationId];
    const species = world.species[officer.speciesId];
    html += '<div class="mini-row" style="cursor:default"><div><strong>' + esc(officer.nameJa) + '</strong><br><small>' +
      esc(nation?.nameJa ?? '無所属') + ' / ' + esc(species?.nameJa ?? '不明') + '</small></div><div style="text-align:right"><strong>' +
      nfmt(officer.age) + '歳</strong><br><small>統率 ' + nfmt(officer.stats.command) + '</small></div></div>';
  }
  html += '<div class="notice">人物の加齢・登用・死亡・世代交代はPhase 4で実装予定。</div>';
  return html;
}
function speciesInfo() {
  let html = '<div class="kicker">SPECIES / 種族図鑑</div><h3>獣人タイプ</h3>';
  for (const species of Object.values(world.species)) {
    const people = Object.values(world.provinces).reduce((sum,p) => sum+(p.populationBySpecies[species.id]??0),0);
    const totals = Object.values(world.armies).reduce((sum,a) => sum+(a.troopsBySpecies[species.id]??0),0);
    html += '<div class="mini-row" style="cursor:default"><div><strong>' + esc(species.nameJa) + '</strong><br><small>武力 ' + nfmt(species.stats.pow) +
      ' / 斥候 ' + nfmt(species.stats.rec) + '</small></div><div style="text-align:right"><strong>' + nfmt(people+totals) + '</strong><br><small>世界総人口</small></div></div>';
  }
  html += '<div class="notice">MVPでは20タイプに拡張予定。現在は契約確認用に柴犬族とヒグマ族のみを収録しています。</div>';
  return html;
}
function historyInfo() {
  let html = '<div class="kicker">CHRONICLE / 世界年表</div><h3>歴史の記録</h3>';
  const events = world.events.slice(-50).reverse();
  if (!events.length) return html + '<div class="notice">まだ歴史イベントはありません。下の「国家への介入」から方針を変更すると、実際の命令に基づく記録が追加されます。</div>';
  for (const event of events) {
    const year = Math.floor(event.monthIndex / 12), month = (event.monthIndex % 12) + 1;
    html += '<div class="mini-row" style="cursor:default"><div><small>世界暦 ' + year + '年 ' + month + '月</small><br><strong>' + esc(event.summaryJa) +
      '</strong></div><span class="tag">' + esc(event.type) + '</span></div>';
  }
  return html;
}
function renderPanel() {
  const views = {region:regionInfo,nations:nationInfo,officers:officersInfo,species:speciesInfo,history:historyInfo};
  $('panel').innerHTML = (views[selectedTab] || regionInfo)();
  $('panel').querySelectorAll('[data-nation]').forEach(button => button.addEventListener('click',() => {
    $('nation-select').value = button.dataset.nation;
    syncStrategy();
    const first = Object.values(world.provinces).find(p => p.ownerNationId === button.dataset.nation);
    if (first) selectedProvince = first.id;
    selectedTab = 'region';
    render();
  }));
}
function syncStrategy() { $('strategy-select').value = world.nations[$('nation-select').value]?.strategy ?? 'balanced'; }
function render() {
  const year = Math.floor(world.monthIndex / 12), month = world.monthIndex % 12 + 1;
  $('calendar').textContent = '世界暦 ' + nfmt(year) + '年 ' + month + '月';
  for (const path of document.querySelectorAll('[data-province]')) {
    const id = path.getAttribute('data-province');
    const province = world.provinces[id], nation = province && world.nations[province.ownerNationId];
    path.setAttribute('fill',nation?.color ?? '#666f70');
    path.classList.toggle('selected',id === selectedProvince);
    path.setAttribute('aria-label',province?.nameJa || id);
  }
  $('legend').innerHTML = allNations().map(n => '<span><i class="dot" style="background:' + esc(n.color) + '"></i>' + esc(n.nameJa) + '</span>').join('');
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active',b.dataset.tab === selectedTab));
  ['pause','speed1','speed5','speed20'].forEach(id => $(id).classList.toggle('active',(id==='pause' && speed===0)||(id==='speed'+speed)));
  renderPanel();
}
function runMonth(orders = []) {
  try {
    const result = advanceMonth(world,orders);
    world = result.world;
    if (result.rejectedOrders.length) notify(result.rejectedOrders[0].reason,true);
    if (world.monthIndex % 12 === 0 || orders.length) saveBrowser();
    render();
    return result;
  } catch(error) {
    stop();
    notify('エンジン処理エラー: ' + String(error?.message ?? error),true);
    return null;
  }
}
function stop() {
  if (timer !== null) clearInterval(timer);
  timer = null; speed = 0; saveBrowser(); render();
}
function start(multiplier) {
  if (timer !== null) clearInterval(timer);
  speed = multiplier;
  timer = setInterval(() => runMonth(),Math.max(50,Math.round(1000 / multiplier)));
  render();
}
function applyStrategy() {
  stop();
  const nationId = $('nation-select').value;
  const strategy = $('strategy-select').value;
  if (!world.nations[nationId]) return notify('国が見つかりません',true);
  const draft = cloneWorld(world);
  draft.player.mode = 'intervention';
  draft.player.selectedNationId = nationId;
  const order = {
    id:'order_' + String(draft.nextIds.order++).padStart(6,'0'),
    issuer:'player',nationId,type:'set_strategy',params:{strategy},submittedMonth:draft.monthIndex
  };
  try {
    const result = advanceMonth(draft,[order]);
    if (result.rejectedOrders.length) return notify(result.rejectedOrders[0].reason,true);
    world = result.world;
    world.player.mode = 'observer'; world.player.selectedNationId = null;
    const name = world.nations[nationId].nameJa;
    selectedTab = 'history'; saveBrowser(); render();
    notify(name + 'の方針を「' + (strategies[strategy] ?? strategy) + '」に変更。1か月進行し、観察モードに戻りました。');
  } catch(error) {notify(String(error?.message ?? error),true);}
}
function downloadSave() {
  try {
    const text = exportSave(world);
    const blob = new Blob([text],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'beastfolk-save-y' + Math.floor(world.monthIndex/12) + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url),1500);
    notify('JSONセーブデータを出力しました。');
  } catch(error) { notify('保存失敗: ' + String(error?.message ?? error),true); }
}
async function importFromInput(event) {
  const file = event.target.files?.[0]; if (!file) return;
  stop();
  try {
    const content = await file.text();
    const imported = importSave(content);
    world = imported; selectedProvince = Object.keys(world.provinces)[0]; selectedTab = 'region';
    refillNations(); saveBrowser(); render(); notify('JSONデータを読み込みました。');
  } catch(error) {notify('読込失敗: ' + String(error?.message ?? error),true);}
  event.target.value = '';
}
function refillNations() {
  const current = $('nation-select').value;
  $('nation-select').innerHTML = '';
  for (const nation of allNations()) {
    const option = document.createElement('option');
    option.value = nation.id; option.textContent = nation.nameJa;
    $('nation-select').append(option);
  }
  if (allNations().some(n => n.id === current)) $('nation-select').value = current;
  syncStrategy();
}

world = restoreWorld();
refillNations();
render();
$('pause').addEventListener('click',stop);
$('speed1').addEventListener('click',() => start(1));
$('speed5').addEventListener('click',() => start(5));
$('speed20').addEventListener('click',() => start(20));
$('step').addEventListener('click',() => {stop();runMonth();saveBrowser();});
document.querySelectorAll('[data-province]').forEach(path => {
  path.setAttribute('tabindex','0');
  path.setAttribute('role','button');
  const select = () => {selectedProvince = path.dataset.province; selectedTab = 'region'; render();};
  path.addEventListener('click',select);
  path.addEventListener('keydown',e => {if (e.key==='Enter' || e.key===' '){e.preventDefault();select();}});
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click',() => {selectedTab=button.dataset.tab; render();}));
$('nation-select').addEventListener('change',syncStrategy);
$('apply-strategy').addEventListener('click',applyStrategy);
$('download').addEventListener('click',downloadSave);
$('import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',importFromInput);
$('reset').addEventListener('click',() => {
  if (!confirm('試作世界を初期化します。現在の進行データは失われます。よろしいですか？')) return;
  stop(); world=createWorld(12345); selectedProvince='province_001'; selectedTab='region';
  refillNations(); saveBrowser(); render(); notify('世界を初期状態に戻しました。');
});
window.addEventListener('pagehide',saveBrowser);
