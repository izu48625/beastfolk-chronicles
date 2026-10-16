// Phase 0 browser preview. Uses the real deterministic core; no fake combat/economy.
import {createWorld, cloneWorld, getNationSummary, totalPopulation, totalTroops} from '../core/world.js';
import {advanceMonth} from '../core/engine.js';
import {exportSave, importSave} from '../core/save.js';
import {getNationDemographics, getSpeciesDemographics} from '../core/demographics.js';
import {OFFICER_SLOTS,officerAssignment,officerFitness} from '../systems/officers.js';
import {getOfficerProfile,getCandidateProfile} from '../core/officerProfiles.js';

const $ = id => document.getElementById(id);
const nfmt = value => new Intl.NumberFormat('ja-JP').format(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const strategies = {balanced:'均衡重視',expansion:'拡張重視',domestic:'内政重視',trade:'商業重視',defense:'防衛重視',diplomacy:'外交重視'};
const terrainNames = {plains:'平原',forest:'森林',hills:'丘陵',mountains:'山岳',wetlands:'湿地',snowfields:'雪原',coast:'沿岸'};
const govNames = {kingdom:'王国',federation:'連邦',republic:'共和国',tribe:'部族'};
const statNames={dom:'内政',eco:'経済',pow:'武力',def:'防御',mob:'機動',rec:'斥候',log:'兵站',dip:'外交'};
const dietNames={omnivore:'雑食',herbivore:'草食',carnivore:'肉食'};
const traitNames={keen_smell:'鋭い嗅覚',heavy_food_demand:'大量の食糧を消費',cold_resistance:'耐寒',heat_sensitive:'暑さに弱い',forest_adapted:'森林適応'};
const slotNames={governor:'統治官',military:'軍事官',advisor:'参謀官'};
const officerStatNames={martial:'武勇',command:'統率',intellect:'知略',administration:'内政',diplomacy:'外交'};
const officerStatColors={martial:'#d58777',command:'#e4b76f',intellect:'#8aaec9',administration:'#7dbba2',diplomacy:'#9a9ac8'};
const officerStatusNames={active:'任地配属',reserve:'予備役',captive:'捕虜',exile:'亡命',retired:'故人・引退'};
const statColors={dom:'#7dbba2',eco:'#a9ad77',pow:'#d58777',def:'#8aaec9',mob:'#e4b76f',rec:'#9fbb8b',log:'#c6ac8c',dip:'#9a9ac8'};
const storageKey = 'beastfolk-p0-preview-v1';
let world;
let selectedProvince = 'province_001';
let selectedTab = 'region';
let selectedNationId = null;
let selectedSpeciesId = null;
let selectedOfficer = null;
let returnOfficerTab = 'officers';
let returnOfficerScroll = 0;
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

function reportBar(percent,color='#bba778'){
  const value=Math.max(0,Math.min(100,Number(percent)||0));
  return '<div class="popbar" aria-hidden="true"><div class="popfill" style="width:'+value.toFixed(2)+'%;background:'+color+'"></div></div>';
}
function metric(label,value){return '<div class="stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';}
function row(label,value){return '<div class="info-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';}
function percentText(v){return (Math.round(v*10)/10).toFixed(1)+'%';}
function renderSpeciesRow(speciesId, counts, percentage){
  const species = world.species[speciesId];
  return '<button class="data-row" data-species="'+esc(speciesId)+'"><div class="data-row-top"><strong>'+esc(species?.nameJa??speciesId)+'</strong><b>'+nfmt(counts.total)+'人 <span class="light">('+percentText(percentage)+')</span></b></div>'
    +reportBar(percentage)+'<div class="data-sub">住民 '+nfmt(counts.civilians)+'人 / 兵士 '+nfmt(counts.military)+'人</div></button>';
}

function regionInfo() {
  const prov = world.provinces[selectedProvince] ?? Object.values(world.provinces)[0];
  if (!prov) return '<p>表示可能な地域がありません。</p>';
  const nation = world.nations[prov.ownerNationId];
  const troops = armyInProvince(prov).reduce((sum, army) => sum + totalTroops(army), 0);
  const population = totalPopulation(prov);
  const entries = Object.entries(prov.populationBySpecies).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  let html='<div class="kicker">PROVINCE / REGION</div><h3>'+esc(prov.nameJa)+'</h3>'
    +'<button class="backlink" data-nation="'+esc(nation?.id??'')+'">領有国：'+esc(nation?.nameJa??'中立')+' →</button>'
    +'<div class="stats">'+metric('民間人口',nfmt(population)+' 人')+metric('駐留兵数',nfmt(troops)+' 人')+'</div>';
  html+=row('地形',terrainNames[prov.terrain]??prov.terrain)+row('開発度',nfmt(prov.development))
    +row('城レベル',nfmt(prov.fortLevel))+row('治安',nfmt(prov.publicOrder)+'/100')
    +row('隣接地域',prov.neighbors.map(id=>world.provinces[id]?.nameJa||id).join('・'));
  html+='<h4>地域の種族別住民人口</h4>';
  for(const [id,pop] of entries){
    html+='<button class="data-row" data-species="'+esc(id)+'"><div class="data-row-top"><strong>'+esc(world.species[id]?.nameJa??id)+'</strong><b>'+nfmt(pop)+'人 <span class="light">('+percentText(population?pop/population*100:0)+')</span></b></div>'
      +reportBar(population?pop/population*100:0)+ '</button>';
  }
  html+='<h4>担当武将 3人</h4>';
  for(const slot of OFFICER_SLOTS){
    const id=prov.slots?.[slot],o=world.officers[id];
    html+='<'+(o?'button':'div')+(o?' type="button" data-officer="'+esc(o.id)+'"':'')+' class="mini-row"><div><strong>'+slotNames[slot]+'</strong><br><small>'+esc(o?.nameJa??'空席')+(o?' →':'')+'</small></div><div style="text-align:right"><strong>'+esc(o?world.species[o.speciesId]?.nameJa??'':'欠員')+'</strong><br><small>'+esc(o?'適性 '+Math.round(officerFitness(o,slot))+' / '+o.age+'歳':'補充が必要')+'</small></div></'+(o?'button':'div')+'>';
  }
  html+='<button class="backlink" data-personnel-link="'+esc(prov.ownerNationId??'')+'">人事・登用の画面へ →</button>';
  return html+'<div class="notice">人口はまだ固定値ですが、人材は毎年生まれ、交代・加齢・死亡します。</div>';
}
function nationInfo() {
  if (selectedNationId && world.nations[selectedNationId]) {
    const n=world.nations[selectedNationId];
    const demo=getNationDemographics(world,n.id), ruler=world.officers[n.rulerOfficerId];
    const capital=world.provinces[n.capitalProvinceId];
    let html='<button class="backlink" data-back="nations">← 国家一覧</button>'
      +'<div class="kicker">NATION / 国内情勢</div><h3><span class="dot" style="background:'+esc(n.color)+'"></span>'+esc(n.nameJa)+'</h3>'
      +'<div class="muted">'+esc(govNames[n.government]??n.government)+' / 君主 '+esc(ruler?.nameJa??'不明')+'</div>'
      +'<div class="stats">'+metric('国家総人口',nfmt(demo.total)+' 人')+metric('民間人口',nfmt(demo.civilians)+' 人')+
       metric('兵士',nfmt(demo.military)+' 人')+metric('支配地域',nfmt(demo.provinceCount))+'</div>'
      +'<h4>種族構成（住民＋兵士）</h4>';
    for(const s of demo.speciesRows)html+=renderSpeciesRow(s.speciesId,s,s.percent);
    html+='<h4>地域別人口</h4>';
    for(const p of demo.regionRows)html+='<button class="mini-row" data-region="'+esc(p.provinceId)+'"><div><strong>'+esc(p.nameJa)+'</strong><br><small>主要種族 '+esc(world.species[p.mainSpeciesId]?.nameJa??'不明')+'</small></div><div style="text-align:right"><strong>'+nfmt(p.total)+'人</strong><br><small>住民 '+nfmt(p.civilians)+' / 兵 '+nfmt(p.military)+'</small></div></button>';
    html+='<button class="backlink" data-personnel-link="'+esc(n.id)+'">地域の担当武将と登用候補を見る →</button>';
    html+='<h4>内政・国力</h4>'+row('首都',capital?.nameJa??'不明')+row('政治体制',govNames[n.government]??n.government)
      +row('政策方針',strategies[n.strategy]??n.strategy)+row('国庫',nfmt(n.treasury))
      +row('食糧備蓄',nfmt(n.food))+row('資材',nfmt(n.materials))
      +row('安定度',nfmt(n.stability)+'/100')
      +row('農業技術',n.tech.agriculture)+row('工業技術',n.tech.industry)+row('軍事技術',n.tech.military)+row('医療技術',n.tech.medicine);
    return html+'<div class="notice">国家・地域データから毎回集計しています。現段階の人口や資源は月次進行ではまだ変化しません。</div>';
  }
  let html='<div class="kicker">NATIONS / 国家一覧</div><h3>国家を選んで国内を調べる</h3>';
  for(const nation of allNations()){
    const s=getNationDemographics(world,nation.id),ruler=world.officers[nation.rulerOfficerId];
    html+='<button class="mini-row" data-nation="'+esc(nation.id)+'"><div><strong><span class="dot" style="background:'+esc(nation.color)+'"></span>'+esc(nation.nameJa)+'</strong><br><small>'+esc(ruler?.nameJa??'不明')+' / '+esc(strategies[nation.strategy]??nation.strategy)+'</small></div><div style="text-align:right"><strong>'+nfmt(s.total)+'人</strong><br><small>'+nfmt(s.provinceCount)+'地域 · '+nfmt(s.speciesRows.length)+'種族</small></div></button>';
  }
  const worldPeople=Object.values(world.provinces).reduce((sum,p)=>sum+totalPopulation(p),0);
  const worldTroops=Object.values(world.armies).reduce((sum,a)=>sum+totalTroops(a),0);
  return html+'<div class="notice">世界人口 '+nfmt(worldPeople+worldTroops)+'人（民間 '+nfmt(worldPeople)+' / 兵士 '+nfmt(worldTroops)+'）。兵士は民間人口に重複計上していません。</div>';
}
function officersInfo() {
  const all=Object.values(world.officers).sort((a,b)=>(b.alive?1:0)-(a.alive?1:0)||a.id.localeCompare(b.id));
  let html='<div class="kicker">OFFICERS / 武将名鑑</div><h3>武将をタップして能力を確認</h3>'
    +'<div class="muted">全'+all.length+'人（現役・予備役・故人を含む）。武将個人の5能力が見られます。</div>';
  for(const o of all){
    const nation=world.nations[o.nationId],species=world.species[o.speciesId],assignment=officerAssignment(world,o.id);
    const post=assignment?' / '+esc(slotNames[assignment.slot])+'（'+esc(world.provinces[assignment.provinceId]?.nameJa??'')+'）':'';
    html+='<button class="mini-row" type="button" data-officer="'+esc(o.id)+'"><div><strong>'+esc(o.nameJa)+'</strong><br><small>'+
      esc(nation?.nameJa??'無所属')+' / '+esc(species?.nameJa??'不明')+post+'</small><br><small>'+esc(officerStatusNames[o.status]??'')+
      ' · 武勇 '+nfmt(o.stats.martial)+' / 統率 '+nfmt(o.stats.command)+'</small></div><div style="text-align:right"><strong>'+
      nfmt(o.age)+'歳</strong><br><small>詳細 →</small></div></button>';
  }
  return html;
}
function speciesInfo() {
  if(selectedSpeciesId && world.species[selectedSpeciesId]){
    const s=world.species[selectedSpeciesId],d=getSpeciesDemographics(world,s.id);
    let html='<button class="backlink" data-back="species">← 種族一覧</button><div class="kicker">SPECIES / 種族図鑑</div><h3>'+esc(s.nameJa)+'</h3>'
      +'<div class="muted">'+esc(dietNames[s.diet]??s.diet)+' / '+esc(s.familyId)+'</div>'
      +'<div class="stats">'+metric('世界総人口',nfmt(d.total)+' 人')+metric('民間人口',nfmt(d.civilians)+' 人')+
       metric('兵士人口',nfmt(d.military)+' 人')+metric('平均寿命の設定',nfmt(s.ecology.lifespan)+' 歳')+'</div>'
      +'<h4>種族基礎能力（0〜100）</h4><div class="stat-chart">';
    for(const [key,label] of Object.entries(statNames)){
      const value=s.stats[key]??0;
      html+='<div class="ability-row"><span>'+esc(label)+'</span>'+reportBar(value,statColors[key])+'<strong>'+nfmt(value)+'</strong></div>';
    }
    html+='</div><h4>生態・固有特性</h4>'
      +row('特性',s.traits.map(t=>traitNames[t]??t).join('・')||'なし')
      +row('食性',dietNames[s.diet]??s.diet)
      +row('体格',nfmt(s.ecology.size))
      +row('食糧要求',nfmt(s.ecology.foodDemand))
      +row('成熟年齢',nfmt(s.ecology.maturityAge)+'歳')
      +row('出生傾向',nfmt(s.ecology.birthRate))
      +row('適応地形',s.ecology.preferredBiomes.map(k=>terrainNames[k]??k).join('・'))
      +'<h4>所属国家の人口構成</h4>';
    for(const n of d.nationRows){
      html+='<button class="data-row" data-nation="'+esc(n.nationId)+'"><div class="data-row-top"><strong>'+esc(n.nameJa)+'</strong><b>'+nfmt(n.total)+'人 ('+percentText(n.percent)+')</b></div>'+reportBar(n.percent)+'<div class="data-sub">住民 '+nfmt(n.civilians)+' / 兵士 '+nfmt(n.military)+'</div></button>';
    }
    return html+'<div class="notice">基礎能力は種族のゲーム上の傾向で、人物個人の能力とは別です。生態の数値は今後バランス調整します。</div>';
  }
  let html='<div class="kicker">SPECIES / 種族図鑑</div><h3>種族を選んで能力を見る</h3>';
  for(const species of Object.values(world.species)){
    const d=getSpeciesDemographics(world,species.id);
    html+='<button class="mini-row" data-species="'+esc(species.id)+'"><div><strong>'+esc(species.nameJa)+'</strong><br><small>武力 '+nfmt(species.stats.pow)+' / 斥候 '+nfmt(species.stats.rec)+' / 内政 '+nfmt(species.stats.dom)+'</small></div><div style="text-align:right"><strong>'+nfmt(d.total)+'人</strong><br><small>8能力を詳しく見る →</small></div></button>';
  }
  return html+'<div class="notice">現在の試作版には2種族のみ登場。20種族へ拡張後もこの図鑑に自動表示されます。</div>';
}

function personnelInfo() {
  const nationId=$('nation-select').value, nation=world.nations[nationId];
  if(!nation?.alive)return '<div class="notice">人事の対象となる国家を選んでください。</div>';
  const provinces=Object.values(world.provinces).filter(p=>p.ownerNationId===nationId).sort((a,b)=>a.id.localeCompare(b.id));
  const candidates=Object.values(world.officerCandidates).filter(c=>c.nationId===nationId).sort((a,b)=>a.id.localeCompare(b.id));
  const assigned=provinces.reduce((sum,p)=>sum+OFFICER_SLOTS.filter(slot=>p.slots?.[slot]).length,0);
  const reserve=Object.values(world.officers).filter(o=>o.nationId===nationId&&o.alive&&o.status==='reserve');
  const captives=Object.values(world.officers).filter(o=>o.alive&&o.status==='captive'&&o.captorNationId===nationId);
  const isControlled=world.player.mode==='intervention'&&world.player.selectedNationId===nationId;
  let html='<div class="kicker">PERSONNEL / 人材登用</div><h3>'+esc(nation.nameJa)+'の人事</h3>'
    +'<div class="stats">'+metric('配属武将',assigned+' / '+provinces.length*3)
    +metric('予備役',reserve.length+'人')+metric('今年の候補',candidates.length+'人')
    +metric('登用可能な捕虜',captives.length+'人')+'</div>'
    +'<button class="backlink" id="personnel-mode-toggle">'+(isControlled?'✓ この国の人事を手動管理中':'この国の人事に介入する')+'</button>'
    +'<div class="notice">'+(isControlled?'介入中：毎年の候補をAIが勝手に登用しません。こちらで採用できます。':'観察中：毎年の候補をAIが自動的に評価・登用します。')+'</div>'
    +'<h4>地域の3武将</h4>';
  for(const prov of provinces){
    html+='<div class="officer-region"><div class="data-row-top"><strong>'+esc(prov.nameJa)+'</strong><span class="light">'+OFFICER_SLOTS.filter(s=>prov.slots[s]).length+'/3人</span></div>';
    for(const slot of OFFICER_SLOTS){
      const id=prov.slots[slot],o=world.officers[id];
      html+='<div class="office-line"><div><span class="light">'+slotNames[slot]+'</span><br>'+(o?'<button type="button" class="officer-name-link" data-officer="'+esc(o.id)+'">'+esc(o.nameJa)+' →</button>':'<strong>空席</strong>')+'</div><div class="office-right">'+(o?'適性 '+Math.round(officerFitness(o,slot)):'欠員')+'</div></div>';
    }
    html+='</div>';
  }
  html+='<h4>今年の登用候補</h4>';
  if(!candidates.length){
    html+='<div class="notice">現在、選考できる候補はいません。世界暦の年初（12か月ごと）に新しい候補が生まれます。「＋1年」で確認できます。</div>';
  }
  const targetOptions=(includeReserve=true)=>{
    let result=includeReserve?'<option value="">予備役として採用</option>':'';
    for(const p of provinces)for(const slot of OFFICER_SLOTS){
      const old=world.officers[p.slots[slot]];
      if(old?.id===nation.rulerOfficerId)continue;
      result+='<option value="'+esc(p.id+'|'+slot)+'">'+esc(p.nameJa+' / '+slotNames[slot]+'：'+(old?.nameJa??'空席'))+'</option>';
    }
    return result;
  };
  for(const candidate of candidates){
    const primary=Object.entries(candidate.stats).sort((a,b)=>b[1]-a[1])[0];
    html+='<div class="candidate-card"><div class="data-row-top"><strong>'+esc(candidate.nameJa)+'</strong><b>'+esc(world.species[candidate.speciesId]?.nameJa??'')+'</b></div>'
      +'<div class="data-sub">'+candidate.age+'歳 · '+esc(primary[0])+' '+primary[1]+' / 統率 '+candidate.stats.command+' / 内政 '+candidate.stats.administration+'</div>'
      +'<button type="button" class="officer-detail-link" data-candidate-detail="'+esc(candidate.id)+'">能力を詳しく見る →</button>'
      +'<div class="candidate-abilities">'+
       Object.entries(candidate.stats).map(([k,v])=>'<span>'+esc(({martial:'武勇',command:'統率',intellect:'知略',administration:'内政',diplomacy:'外交'})[k])+' '+v+'</span>').join('')
      +'</div><label class="candidate-label" for="target-'+esc(candidate.id)+'">採用先・交代する役職</label>'
      +'<select class="candidate-select" id="target-'+esc(candidate.id)+'">'+targetOptions()+'</select>'
      +'<button class="hire-btn" data-hire="'+esc(candidate.id)+'">この候補を登用する</button></div>';
  }
  html+='<h4>予備役の武将</h4>';
  if(!reserve.length)html+='<div class="muted">予備役はいません。</div>';
  for(const officer of reserve){
    html+='<div class="candidate-card"><div class="data-row-top"><strong>'+esc(officer.nameJa)+'</strong><span class="light">'+esc(world.species[officer.speciesId]?.nameJa??'')+'</span></div>'
      +'<button type="button" class="officer-detail-link" data-officer="'+esc(officer.id)+'">武将の能力を見る →</button>'
      +'<div class="data-sub">'+officer.age+'歳 / 武勇 '+officer.stats.martial+' / 統率 '+officer.stats.command+' / 内政 '+officer.stats.administration+'</div>'
      +'<select class="candidate-select" id="assign-'+esc(officer.id)+'">'+targetOptions(false)+'</select>'
      +'<button class="hire-btn" data-assign="'+esc(officer.id)+'">地域へ配置する</button></div>';
  }
  html+='<h4>敵国から獲得した捕虜</h4>';
  if(!captives.length)html+='<div class="muted">現在は捕虜がいません。敵国滅亡後の獲得処理は今後の戦争システムで発生します。</div>';
  for(const officer of captives){
    html+='<div class="candidate-card"><strong>'+esc(officer.nameJa)+'</strong><button type="button" class="officer-detail-link" data-officer="'+esc(officer.id)+'">武将の能力を見る →</button><div class="data-sub">'+esc(world.species[officer.speciesId]?.nameJa??'')+' / 統率 '+officer.stats.command+'</div>'
      +'<select class="candidate-select" id="captive-'+esc(officer.id)+'">'+targetOptions()+'</select>'
      +'<button class="hire-btn" data-recruit-captive="'+esc(officer.id)+'">旧敵将を登用する</button></div>';
  }
  return html;
}

function officerDetailInfo() {
  if(!selectedOfficer)return '<div class="notice">武将を選択してください。</div>';
  let p;
  try{
    p=selectedOfficer.kind==='candidate'?getCandidateProfile(world,selectedOfficer.id):getOfficerProfile(world,selectedOfficer.id);
  }catch{
    return '<button class="backlink" data-officer-back="1">← 戻る</button><div class="notice">この人物のデータは更新され、現在は表示できません。</div>';
  }
  const isCandidate=p.kind==='candidate',assignment=p.assignment;
  const slotLabel=assignment?slotNames[assignment.slot]:'なし';
  const provinceName=assignment?world.provinces[assignment.provinceId]?.nameJa??assignment.provinceId:'未配属';
  const status=isCandidate?'登用候補':officerStatusNames[p.status]??p.status;
  const title=isCandidate?'CANDIDATE / 登用候補':'OFFICER / 武将詳細';
  const statRows=Object.entries(officerStatNames).map(([key,label])=>{
    const val=p.stats[key];
    return '<div class="officer-ability"><span>'+label+'</span>'+reportBar(val,officerStatColors[key])+
       '<strong>'+nfmt(val)+'</strong></div>';
  }).join('');
  let html='<button class="backlink" data-officer-back="1">← '+(returnOfficerTab==='region'?'地域情報':returnOfficerTab==='personnel'?'人事・登用':'武将名鑑')+'へ戻る</button>'
    +'<div class="kicker">'+title+'</div><h3>'+esc(p.nameJa)+'</h3>'
    +'<div class="officer-tags"><span>'+esc(p.speciesNameJa)+'</span><span>'+esc(status)+'</span><span>'+esc(p.age)+'歳</span></div>'
    +'<div class="stats">'+metric('忠誠',nfmt(p.loyalty)+' / 100')+metric('経験',nfmt(p.experience))+'</div>'
    +'<h4>個人ステータス（0〜100）</h4><div class="stat-chart">'+statRows+'</div>'
    +'<h4>役職適性</h4><div class="stat-chart">';
  for(const a of p.fits) {
    html+='<div class="officer-ability"><span>'+esc(slotNames[a.slot])+'</span>'+
      reportBar(a.fitness,a.slot==='governor'?'#7dbba2':a.slot==='military'?'#d58777':'#8aaec9')+
      '<strong>'+a.fitness.toFixed(1)+'</strong></div>';
  }
  html+='</div><div class="notice">最も向いている役職：'+esc(slotNames[p.bestSlot])+'。適性は個人の5能力から計算した参考値で、種族の8能力とは別です。</div>'
    +'<h4>所属・経歴</h4>'
    +row('所属国家',p.nationNameJa)+row('現在の役職',slotLabel)
    +row('任地',provinceName)+row('状態',status)
    +(isCandidate?row('候補登場年','世界暦 '+p.year+'年'):'')
    +row('特性',p.traits.length?p.traits.map(x=>traitNames[x]??x).join('・'):'なし')
    +(!isCandidate?row('指揮軍団',p.armyIds.length?p.armyIds.join('・'):'なし'):'')
    +'<button class="backlink" data-species="'+esc(p.speciesId)+'">種族の8能力を見る →</button>';
  if(!isCandidate){
    html+='<h4>人物の歴史</h4>';
    if(!p.events.length)html+='<div class="muted">この武将の記録済みイベントはまだありません。</div>';
    for(const event of p.events){
      const y=Math.floor(event.monthIndex/12),m=event.monthIndex%12+1;
      html+='<div class="history-person"><small>世界暦 '+y+'年 '+m+'月</small><div>'+esc(event.summaryJa)+'</div></div>';
    }
  }
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
  const views={region:regionInfo,nations:nationInfo,officers:officersInfo,species:speciesInfo,history:historyInfo,personnel:personnelInfo,officerDetail:officerDetailInfo};
  const panel=$('panel'),scroll=panel.scrollTop;
  panel.innerHTML=(views[selectedTab]||regionInfo)();
  panel.scrollTop=scroll;
  panel.querySelectorAll('[data-officer]').forEach(button=>button.addEventListener('click',()=>{
    if(!world.officers[button.dataset.officer])return;
    selectedOfficer={kind:'officer',id:button.dataset.officer};
    returnOfficerTab=selectedTab;returnOfficerScroll=panel.scrollTop;
    selectedTab='officerDetail';panel.scrollTop=0;render();
  }));
  panel.querySelectorAll('[data-candidate-detail]').forEach(button=>button.addEventListener('click',()=>{
    if(!world.officerCandidates[button.dataset.candidateDetail])return;
    selectedOfficer={kind:'candidate',id:button.dataset.candidateDetail};
    returnOfficerTab=selectedTab;returnOfficerScroll=panel.scrollTop;
    selectedTab='officerDetail';panel.scrollTop=0;render();
  }));
  panel.querySelectorAll('[data-officer-back]').forEach(button=>button.addEventListener('click',()=>{
    selectedTab=returnOfficerTab;selectedOfficer=null;panel.scrollTop=returnOfficerScroll;render();
  }));
  panel.querySelectorAll('[data-nation]').forEach(button=>button.addEventListener('click',()=>{
    const nation=world.nations[button.dataset.nation];
    if(!nation)return;
    selectedNationId=nation.id;selectedTab='nations';panel.scrollTop=0;render();
  }));
  panel.querySelectorAll('[data-species]').forEach(button=>button.addEventListener('click',()=>{
    if(!world.species[button.dataset.species])return;
    selectedSpeciesId=button.dataset.species;selectedTab='species';panel.scrollTop=0;render();
  }));
  panel.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{
    if(!world.provinces[button.dataset.region])return;
    selectedProvince=button.dataset.region;selectedTab='region';panel.scrollTop=0;render();
  }));
  panel.querySelectorAll('[data-personnel-link]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.personnelLink;
    if(!world.nations[id]?.alive)return;
    $('nation-select').value=id;syncStrategy();selectedTab='personnel';panel.scrollTop=0;render();
  }));
  panel.querySelectorAll('[data-hire]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.hire,value=$('target-'+id)?.value??'';
    officerCommand('hire_candidate',{candidateId:id},value);
  }));
  panel.querySelectorAll('[data-assign]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.assign,value=$('assign-'+id)?.value??'';
    officerCommand('assign_officer',{officerId:id},value);
  }));
  panel.querySelectorAll('[data-recruit-captive]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.recruitCaptive,value=$('captive-'+id)?.value??'';
    officerCommand('recruit_captive',{officerId:id},value);
  }));
  const toggle=panel.querySelector('#personnel-mode-toggle');
  if(toggle)toggle.addEventListener('click',()=>{
    stop();
    const nationId=$('nation-select').value;
    if(world.player.mode==='intervention'&&world.player.selectedNationId===nationId) {
      world.player.mode='observer';world.player.selectedNationId=null;
      notify('自動人事に戻しました。');
    } else {
      world.player.mode='intervention';world.player.selectedNationId=nationId;
      notify('この国の人事に介入中です。候補は自動登用されません。');
    }
    saveBrowser();render();
  });
  panel.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.back==='nations')selectedNationId=null;
    if(button.dataset.back==='species')selectedSpeciesId=null;
    panel.scrollTop=0;render();
  }));
}
function syncStrategy() { $('strategy-select').value = world.nations[$('nation-select').value]?.strategy ?? 'balanced'; }
function render(refreshPanel=true) {
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
  if(refreshPanel)renderPanel();
}
function runMonth(orders = []) {
  try {
    const result = advanceMonth(world,orders);
    world = result.world;
    if (result.rejectedOrders.length) notify(result.rejectedOrders[0].reason,true);
    if (world.monthIndex % 12 === 0 || orders.length) saveBrowser();
    render(speed===0 || orders.length>0 || world.monthIndex%12===0);
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

function officerCommand(type,params,target){
  stop();
  const nationId=$('nation-select').value;
  const previousMode=world.player.mode,previousSelected=world.player.selectedNationId;
  const draft=cloneWorld(world);
  draft.player.mode='intervention';draft.player.selectedNationId=nationId;
  const [targetProvinceId,slot]=target?target.split('|'):[null,null];
  if(type==='assign_officer'&&!targetProvinceId)return notify('配属先を選択してください',true);
  const order={id:'order_'+String(draft.nextIds.order++).padStart(6,'0'),
    issuer:'player',nationId,type,params:{...params,...(slot?{slot}:{})},submittedMonth:draft.monthIndex,
    ...(targetProvinceId?{targetProvinceId}:{})};
  try{
    const result=advanceMonth(draft,[order]);
    if(result.rejectedOrders.length)return notify(result.rejectedOrders[0].reason,true);
    world=result.world;
    world.player.mode=previousMode;
    world.player.selectedNationId=previousSelected;
    selectedTab='personnel';saveBrowser();render();
    notify('人事命令が承認され、1か月進行しました。');
  }catch(error){notify('人事エラー: '+String(error?.message??error),true);}
}

function applyStrategy() {
  stop();
  const nationId = $('nation-select').value;
  const strategy = $('strategy-select').value;
  if (!world.nations[nationId]) return notify('国が見つかりません',true);
  const previousMode=world.player.mode,previousNation=world.player.selectedNationId;
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
    world.player.mode=previousMode; world.player.selectedNationId=previousNation;
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
    world = imported; selectedProvince = Object.keys(world.provinces)[0]; selectedTab = 'region'; selectedNationId=null; selectedSpeciesId=null; selectedOfficer=null;
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
$('step-year').addEventListener('click',()=>{stop();for(let i=0;i<12;i++)if(!runMonth())break;saveBrowser();notify('12か月進めました。');});
document.querySelectorAll('[data-province]').forEach(path => {
  path.setAttribute('tabindex','0');
  path.setAttribute('role','button');
  const select = () => {selectedProvince = path.dataset.province; selectedTab = 'region'; render();};
  path.addEventListener('click',select);
  path.addEventListener('keydown',e => {if (e.key==='Enter' || e.key===' '){e.preventDefault();select();}});
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click',() => {selectedTab=button.dataset.tab; render();}));
$('nation-select').addEventListener('change',()=>{
  syncStrategy();
  if(world.player.mode==='intervention'){world.player.selectedNationId=$('nation-select').value;saveBrowser();}
  if(selectedTab==='personnel')render();
});
$('apply-strategy').addEventListener('click',applyStrategy);
$('download').addEventListener('click',downloadSave);
$('import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',importFromInput);
$('reset').addEventListener('click',() => {
  if (!confirm('試作世界を初期化します。現在の進行データは失われます。よろしいですか？')) return;
  stop(); world=createWorld(12345); selectedProvince='province_001'; selectedTab='region'; selectedNationId=null; selectedSpeciesId=null; selectedOfficer=null;
  refillNations(); saveBrowser(); render(); notify('世界を初期状態に戻しました。');
});
window.addEventListener('pagehide',saveBrowser);
