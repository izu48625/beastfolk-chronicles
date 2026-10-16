import {createRng} from '../core/rng.js';

export const OFFICER_SLOTS = Object.freeze(['governor','military','advisor']);
export const OFFICER_STATUS = Object.freeze(['active','reserve','captive','exile','retired']);
const labels={governor:'統治官',military:'軍事官',advisor:'参謀官'};
const given=['ガル','レオン','リオ','セナ','テオ','ミラ','カイ','ニア','ラグ','ロイ','エル','シド','ヴァル','マル','ソラ','リン','アル','ミオ','バル','ノア'];
const surnames=['黒牙','銀尾','灰爪','赤森','白峰','遠吠','夜目','月影','大角','石斧','風走','雪原','鉄爪','朝霧','黒峰'];
const clamp=(x)=>Math.max(0,Math.min(100,Math.round(x)));
const ordered=(r)=>Object.values(r).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const pick=(rng,a)=>a[rng.nextInt(0,a.length-1)];
const speciesWeight=(world,nationId)=>{
  const weights={};
  for(const p of ordered(world.provinces)) if(p.ownerNationId===nationId) {
    for(const [id,amount] of Object.entries(p.populationBySpecies))weights[id]=(weights[id]??0)+amount;
  }
  return Object.entries(weights).filter(x=>x[1]>0).sort((a,b)=>a[0]<b[0]?-1:1);
};
function chooseSpecies(world,nationId,rng){
  const weights=speciesWeight(world,nationId);
  const total=weights.reduce((s,x)=>s+x[1],0);
  if(total===0)return Object.keys(world.species).sort()[0];
  let roll=rng.nextInt(1,total);
  for(const [id,amount] of weights){roll-=amount;if(roll<=0)return id;}
  return weights[0][0];
}
function candidateData(world,nationId,rng){
  const speciesId=chooseSpecies(world,nationId,rng);
  const species=world.species[speciesId];
  const s=species.stats,years=rng.nextInt(18,37);
  const aptitude=rng.nextInt(-13,16),talent=rng.nextInt(-10,19);
  return {
    nameJa:pick(rng,given)+'・'+pick(rng,surnames),speciesId,nationId,age:years,
    stats:{
      martial:clamp(s.pow*.65+s.mob*.25+aptitude+rng.nextInt(-9,9)),
      command:clamp(s.pow*.28+s.log*.32+s.def*.25+talent+rng.nextInt(-9,9)),
      intellect:clamp(s.dom*.35+s.rec*.30+s.eco*.25+talent+rng.nextInt(-9,9)),
      administration:clamp(s.dom*.43+s.eco*.42+aptitude+rng.nextInt(-9,9)),
      diplomacy:clamp(s.dip*.62+s.dom*.22+talent+rng.nextInt(-9,9))
    },
    traits:rng.nextInt(0,3)===0?[...species.traits]:[],
    loyalty:rng.nextInt(58,90),experience:rng.nextInt(0,25)
  };
}
function appendEvent(world,type,summaryJa,nationIds=[],officerIds=[],payload={}){
  const event={
    id:'event_'+String(world.nextIds.event++).padStart(6,'0'),
    monthIndex:world.monthIndex,type,summaryJa,nationIds,provinceIds:[],officerIds,speciesIds:[],payload
  };
  world.events.push(event);return event;
}
function makeOfficer(world,data,rng){
  const id='officer_'+String(world.nextIds.officer++).padStart(3,'0');
  const newOfficer={id,...data,role:'unassigned',status:'reserve',alive:true};
  world.officers[id]=newOfficer;return newOfficer;
}
export function officerFitness(officer,slot){
  const a=officer.stats;
  if(slot==='governor')return a.administration*.65+a.intellect*.35;
  if(slot==='military')return a.command*.60+a.martial*.40;
  if(slot==='advisor')return a.intellect*.52+a.diplomacy*.48;
  throw new RangeError('unknown officer slot');
}
export function officerAssignment(world,officerId){
  for(const province of ordered(world.provinces))
    for(const slot of OFFICER_SLOTS)
      if(province.slots?.[slot]===officerId)return {provinceId:province.id,slot};
  return null;
}
/** Assign exactly one province slot per person. Replaced incumbents become reserves. */
export function assignOfficer(world,nationId,officerId,provinceId,slot,{issuer='player'}={}){
  const nation=world.nations[nationId],prov=world.provinces[provinceId],officer=world.officers[officerId];
  if(!nation?.alive || prov?.ownerNationId!==nationId || !OFFICER_SLOTS.includes(slot)
    || !officer?.alive || officer.nationId!==nationId || !['active','reserve'].includes(officer.status))
    throw new RangeError('配置先・武将・所属国家が不正です');
  const old=prov.slots[slot];
  if(old && world.nations[nationId].rulerOfficerId===old && old!==officerId)
    throw new RangeError('君主を地域担当から外すことはできません');
  if(old===officerId)return null;
  const previous=officerAssignment(world,officerId);
  if(previous)world.provinces[previous.provinceId].slots[previous.slot]=null;
  if(old)world.officers[old].status='reserve';
  prov.slots[slot]=officerId;officer.status='active';
  return appendEvent(world,'officer_assigned',officer.nameJa+'が'+prov.nameJa+'の'+labels[slot]+'に就任した',
    [nationId],[officerId],{provinceId,slot,replacedOfficerId:old,previous,issuer});
}
export function hireCandidate(world,nationId,candidateId,provinceId=null,slot=null,issuer='player'){
  const candidate=world.officerCandidates[candidateId];
  if(!world.nations[nationId]?.alive||candidate?.nationId!==nationId)throw new RangeError('対象候補が見つかりません');
  if(provinceId!==null && (!world.provinces[provinceId] || world.provinces[provinceId].ownerNationId!==nationId || !OFFICER_SLOTS.includes(slot)))
    throw new RangeError('指定した配属先が不正です');
  if(provinceId!==null){
    const occupant=world.provinces[provinceId].slots[slot];
    if(occupant===world.nations[nationId].rulerOfficerId)throw new RangeError('君主を配置から外せません');
  }
  const officer=makeOfficer(world,{
    nameJa:candidate.nameJa,speciesId:candidate.speciesId,nationId,age:candidate.age,stats:{...candidate.stats},
    traits:[...candidate.traits],loyalty:candidate.loyalty,experience:candidate.experience
  });
  delete world.officerCandidates[candidateId];
  appendEvent(world,'officer_hired',world.nations[nationId].nameJa+'が'+officer.nameJa+'を登用した',
    [nationId],[officer.id],{candidateId,issuer});
  if(provinceId!==null)assignOfficer(world,nationId,officer.id,provinceId,slot,{issuer});
  return officer;
}
export function recruitCaptive(world,nationId,officerId,provinceId=null,slot=null,issuer='player'){
  const o=world.officers[officerId],n=world.nations[nationId];
  if(!n?.alive||!o?.alive||o.status!=='captive'||o.captorNationId!==nationId)
    throw new RangeError('登用可能な捕虜武将ではありません');
  if(provinceId!==null){
    const p=world.provinces[provinceId];
    if(!p||p.ownerNationId!==nationId||!OFFICER_SLOTS.includes(slot)||p.slots[slot]===n.rulerOfficerId)
      throw new RangeError('登用先が不正です');
  }
  o.nationId=nationId;o.status='reserve';o.captorNationId=null;
  o.loyalty=Math.max(25,Math.min(65,o.loyalty-18));
  appendEvent(world,'former_enemy_hired',n.nameJa+'が旧敵将'+o.nameJa+'を登用した',[nationId],[officerId],{issuer});
  if(provinceId!==null)assignOfficer(world,nationId,officerId,provinceId,slot,{issuer});
  return o;
}
/** V1->V2 deterministic expansion; separate derived RNG avoids consuming old world's rngState. */
export function initializeOfficerSystem(world){
  if(world.officerCandidates!==undefined)return world;
  world.officerCandidates={};
  world.nextIds.candidate=1;
  for(const officer of ordered(world.officers)){officer.status='reserve';officer.captorNationId=null;}
  for(const province of ordered(world.provinces))province.slots={governor:null,military:null,advisor:null};
  const rng=createRng((world.seed^0xA41C709E)>>>0);
  for(const nation of ordered(world.nations).filter(n=>n.alive)){
    const ruler=world.officers[nation.rulerOfficerId];
    world.provinces[nation.capitalProvinceId].slots.governor=ruler.id;ruler.status='active';
  }
  for(const province of ordered(world.provinces)){
    if(!province.ownerNationId)continue;
    for(const slot of OFFICER_SLOTS)if(!province.slots[slot]){
      const info=candidateData(world,province.ownerNationId,rng);
      const officer=makeOfficer(world,info,rng);
      province.slots[slot]=officer.id;officer.status='active';
      officer.role=slot==='governor'?'administrator':slot==='military'?'general':'diplomat';
    }
  }
  return world;
}
function recruitBestAI(world,nationId,candidate){
  const provinces=ordered(world.provinces).filter(p=>p.ownerNationId===nationId);
  let best=null;
  for(const p of provinces)for(const slot of OFFICER_SLOTS){
    const old=p.slots[slot];
    if(old===world.nations[nationId].rulerOfficerId)continue;
    const delta=officerFitness(candidate,slot)-(old?officerFitness(world.officers[old],slot):0);
    if(old && delta<9)continue;
    const priority=old?delta:100+delta;
    if(best===null||priority>best.priority)
      best={provinceId:p.id,slot,priority};
  }
  return best;
}
function addCandidates(world,rng){
  for(const nation of ordered(world.nations).filter(n=>n.alive)){
    const provinces=ordered(world.provinces).filter(p=>p.ownerNationId===nation.id).length;
    const count=Math.max(1,Math.min(6,Math.ceil(provinces/3)));
    for(let k=0;k<count;k++){
      const id='candidate_'+String(world.nextIds.candidate++).padStart(5,'0');
      world.officerCandidates[id]={id,...candidateData(world,nation.id,rng),year:Math.floor(world.monthIndex/12)};
    }
    appendEvent(world,'officer_candidates',nation.nameJa+'で新たな人材候補'+count+'人が選出された',
      [nation.id],[],{candidateCount:count});
  }
}
function handover(world,dead,rng){
  const n=world.nations[dead.nationId];
  if(!n?.alive)return;
  const available=ordered(world.officers).filter(o=>o.alive&&o.nationId===n.id&&o.status!=='captive'&&o.status!=='exile'&&o.status!=='retired');
  if(!available.length){
    // Keep the last ruler alive: no active state may reference a dead ruler.
    dead.alive=true;dead.role='ruler';dead.status='active';return;
  }
  const candidate=available.sort((a,b)=>officerFitness(b,'advisor')-officerFitness(a,'advisor')||(a.id<b.id?-1:1))[0];
  if(n.rulerOfficerId===dead.id){
    n.rulerOfficerId=candidate.id;candidate.role='ruler';
    appendEvent(world,'ruler_succeeded',n.nameJa+'の新君主に'+candidate.nameJa+'が就任した',[n.id],[candidate.id,dead.id],{});
  }
  for(const army of ordered(world.armies))if(army.commanderId===dead.id && army.nationId===n.id)
    army.commanderId=candidate.id;
}
function ageAndRetire(world,rng){
  for(const officer of ordered(world.officers)){
    if(!officer.alive||officer.status==='retired')continue;
    officer.age+=1;
    if(officer.age<65)continue;
    const risk=officer.age>=105?100:Math.min(55,Math.max(0,(officer.age-63)*1.65));
    if(rng.nextFloat()*100>=risk)continue;
    const before=officer.status;
    officer.alive=false;officer.role='unassigned';officer.status='retired';officer.captorNationId=null;
    const assignment=officerAssignment(world,officer.id);
    if(assignment)world.provinces[assignment.provinceId].slots[assignment.slot]=null;
    handover(world,officer,rng);
    if(officer.alive) {
      if(assignment){world.provinces[assignment.provinceId].slots[assignment.slot]=officer.id;}
      officer.status=before;continue;
    }
    appendEvent(world,'officer_died',officer.nameJa+'が生涯を終えた',
      officer.nationId?[officer.nationId]:[],[officer.id],{age:officer.age});
  }
}
export function processAnnualOfficers(world,rng){
  // Called at the start of year after monthIndex increments.
  if(world.monthIndex===0 || world.monthIndex%12!==0)return;
  for(const id of Object.keys(world.officerCandidates))delete world.officerCandidates[id];
  ageAndRetire(world,rng);
  addCandidates(world,rng);
  for(const nation of ordered(world.nations).filter(n=>n.alive)){
    if(world.player.mode==='intervention' && world.player.selectedNationId===nation.id)continue;
    for(const candidate of ordered(world.officerCandidates).filter(c=>c.nationId===nation.id)){
      const best=recruitBestAI(world,nation.id,candidate);
      if(best)hireCandidate(world,nation.id,candidate.id,best.provinceId,best.slot,'ai');
    }
  }
}
/** Called by the future war/conquest resolver, NOT automatically without a real defeat. */
export function settleDefeatedOfficers(world,defeatedNationId,victorNationId,rng){
  const defeated=world.nations[defeatedNationId],victor=world.nations[victorNationId];
  if(!defeated||defeated.alive||!victor?.alive||defeatedNationId===victorNationId)
    throw new RangeError('滅亡国と勝者の状態が不正です');
  // The military engine must first transfer territory and remove/transfer defeated armies.
  if(Object.values(world.provinces).some(p=>p.ownerNationId===defeatedNationId)
    ||Object.values(world.armies).some(a=>a.nationId===defeatedNationId))
    throw new RangeError('敵領地／残存軍の処理が完了していません');
  const statuses=[];
  for(const officer of ordered(world.officers).filter(o=>o.alive&&o.nationId===defeatedNationId)){
    const former=officerAssignment(world,officer.id);
    if(former)world.provinces[former.provinceId].slots[former.slot]=null;
    const roll=rng.nextFloat();
    const status=roll<.6?'captive':roll<.85?'exile':'retired';
    officer.nationId=null;officer.role='unassigned';officer.status=status;
    officer.captorNationId=status==='captive'?victorNationId:null;
    if(status==='retired')officer.alive=false;
    statuses.push({officerId:officer.id,status});
    appendEvent(world,'officer_after_defeat',officer.nameJa+'は'+({captive:'捕虜',exile:'亡命',retired:'引退'}[status])+'となった',
      [defeatedNationId,victorNationId],[officer.id],{status,former});
  }
  for(const id of Object.keys(world.officerCandidates))if(world.officerCandidates[id].nationId===defeatedNationId)delete world.officerCandidates[id];
  return statuses;
}
