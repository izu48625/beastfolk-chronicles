import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,cloneWorld} from '../src/core/world.js';
import {advanceMonth} from '../src/core/engine.js';
import {exportSave,importSave} from '../src/core/save.js';
import {createRng} from '../src/core/rng.js';
import {validateWorld} from '../src/core/validation.js';
import {OFFICER_SLOTS,officerAssignment,settleDefeatedOfficers,hireCandidate} from '../src/systems/officers.js';

const allSlots=w=>Object.values(w.provinces).flatMap(p=>OFFICER_SLOTS.map(s=>p.slots[s]));
const age=w=>{for(let i=0;i<12;i++)w=advanceMonth(w).world;return w;};

test('new scenario starts with exactly three unique officers per province',()=>{
  const w=createWorld(14);
  const slots=allSlots(w);
  assert.equal(slots.length,12);assert.equal(new Set(slots).size,12);
  assert.ok(slots.every(Boolean));
  assert.equal(Object.keys(w.officers).length,12);
  assert.equal(w.officerCandidates&&Object.keys(w.officerCandidates).length,0);
  assert.equal(w.nextIds.candidate,1);
  for(const n of Object.values(w.nations)){
    assert.equal(officerAssignment(w,n.rulerOfficerId).provinceId,n.capitalProvinceId);
  }
  assert.deepEqual(validateWorld(w),{ok:true,errors:[]});
});
test('same seed creates identical officer rosters and yearly candidates',()=>{
  let a=createWorld(77),b=createWorld(77);
  for(let i=0;i<120;i++){a=advanceMonth(a).world;b=advanceMonth(b).world;}
  assert.deepEqual(a,b);
  assert.deepEqual(validateWorld(a),{ok:true,errors:[]});
});
test('one year produces candidates and AI recruitment without overbooking',()=>{
  const a=age(createWorld(9));
  assert.equal(a.monthIndex,12);
  assert.ok(a.events.some(e=>e.type==='officer_candidates'));
  assert.equal(Object.values(a.officerCandidates).every(c=>c.year===1),true);
  assert.equal(new Set(allSlots(a).filter(Boolean)).size,allSlots(a).filter(Boolean).length);
  assert.deepEqual(validateWorld(a),{ok:true,errors:[]});
});
test('intervention can hire candidate replacing non-ruler and keep incumbent reserve',()=>{
  let w=createWorld(19);
  w.player.mode='intervention';w.player.selectedNationId='nation_001';
  w=age(w);
  const candidate=Object.values(w.officerCandidates).find(c=>c.nationId==='nation_001');
  assert.ok(candidate);
  const p=w.provinces.province_002;
  const old=p.slots.military;
  const order={id:'order_manual1',issuer:'player',nationId:'nation_001',type:'hire_candidate',
    targetProvinceId:p.id,params:{candidateId:candidate.id,slot:'military'},submittedMonth:w.monthIndex};
  const before=JSON.stringify(w);
  const result=advanceMonth(w,[order]);
  assert.equal(result.rejectedOrders.length,0);
  assert.equal(result.acceptedOrders.length,1);
  assert.equal(JSON.stringify(w),before);
  const next=result.world;
  assert.equal(next.officers[old].status,'reserve');
  assert.notEqual(next.provinces.province_002.slots.military,old);
  assert.equal(next.officerCandidates[candidate.id],undefined);
  assert.ok(next.events.some(e=>e.type==='officer_hired'));
  assert.deepEqual(validateWorld(next),{ok:true,errors:[]});
});
test('ruler protected and non-controlled country rejected',()=>{
  let w=createWorld(32);
  w.player.mode='intervention';w.player.selectedNationId='nation_001';
  w=age(w);const c=Object.values(w.officerCandidates).find(c=>c.nationId==='nation_001');
  const order={id:'o',issuer:'player',nationId:'nation_001',type:'hire_candidate',
    targetProvinceId:'province_001',params:{candidateId:c.id,slot:'governor'},submittedMonth:w.monthIndex};
  const x=advanceMonth(w,[order]);
  assert.equal(x.rejectedOrders[0].code,'RULER_POST');
  assert.equal(x.world.provinces.province_001.slots.governor,w.nations.nation_001.rulerOfficerId);
});
test('reassign maintains exclusive regional appointment',()=>{
  let w=createWorld(82);w.player.mode='intervention';w.player.selectedNationId='nation_001';
  const officerId=w.provinces.province_002.slots.advisor;
  const old=w.provinces.province_001.slots.military;
  const x=advanceMonth(w,[{id:'move',issuer:'player',nationId:'nation_001',type:'assign_officer',
      targetProvinceId:'province_001',params:{officerId,slot:'military'},submittedMonth:0}]);
  assert.equal(x.rejectedOrders.length,0);
  const n=x.world;
  assert.equal(n.provinces.province_002.slots.advisor,null);
  assert.equal(n.provinces.province_001.slots.military,officerId);
  assert.equal(n.officers[old].status,'reserve');
  assert.deepEqual(validateWorld(n),{ok:true,errors:[]});
});
test('v1 save auto migrates without touching saved RNG state and legacy nation data',()=>{
  const w=createWorld(999);
  const legacy=cloneWorld(w);
  for(const p of Object.values(legacy.provinces))delete p.slots;
  for(const o of Object.values(legacy.officers)){delete o.status;delete o.captorNationId;}
  for(const id of Object.keys(legacy.officers))if(!['officer_001','officer_002'].includes(id))delete legacy.officers[id];
  delete legacy.officerCandidates;delete legacy.nextIds.candidate;
  legacy.nextIds.officer=3;legacy.schemaVersion=1;
  const imported=importSave(JSON.stringify(legacy));
  assert.equal(imported.schemaVersion,2);
  assert.equal(imported.seed,999);assert.equal(imported.rngState,legacy.rngState);
  assert.equal(imported.monthIndex,legacy.monthIndex);
  assert.equal(allSlots(imported).length,12);
  assert.deepEqual(validateWorld(imported),{ok:true,errors:[]});
});
test('save -> load preserves annual candidates and AI future replay',()=>{
  let w=createWorld(23);w.player.mode='intervention';w.player.selectedNationId='nation_001';w=age(w);
  let restored=importSave(exportSave(w));
  assert.deepEqual(restored,w);
  for(let i=0;i<60;i++){w=advanceMonth(w).world;restored=advanceMonth(restored).world;}
  assert.deepEqual(w,restored);
});
test('defeated generals become captives, exiles or retirees and captives are recruitable',()=>{
  const w=createWorld(5),loser='nation_001',winner='nation_002';
  w.nations[loser].alive=false;
  for(const p of Object.values(w.provinces))if(p.ownerNationId===loser)p.ownerNationId=winner;
  for(const a of Object.values(w.armies))if(a.nationId===loser){
    w.provinces[a.provinceId].garrisonArmyIds=w.provinces[a.provinceId].garrisonArmyIds.filter(id=>id!==a.id);
    delete w.armies[a.id];
  }
  const result=settleDefeatedOfficers(w,loser,winner,createRng(13));
  assert.equal(result.length,6);
  assert.ok(result.every(x=>['captive','exile','retired'].includes(x.status)));
  const captive=result.find(x=>x.status==='captive');
  assert.ok(captive);
  const c=w.officers[captive.officerId];
  assert.equal(c.nationId,null);assert.equal(c.captorNationId,winner);
  assert.deepEqual(validateWorld(w),{ok:true,errors:[]});
  w.player.mode='intervention';w.player.selectedNationId=winner;
  const x=advanceMonth(w,[{id:'hireformer',issuer:'player',nationId:winner,type:'recruit_captive',
    params:{officerId:c.id},submittedMonth:w.monthIndex}]);
  assert.equal(x.rejectedOrders.length,0);
  assert.equal(x.world.officers[c.id].nationId,winner);
  assert.equal(x.world.officers[c.id].status,'reserve');
  assert.deepEqual(validateWorld(x.world),{ok:true,errors:[]});
});
test('per-province duplicate officer assignments are rejected',()=>{
  const w=createWorld(4);
  w.provinces.province_002.slots.governor=w.provinces.province_001.slots.governor;
  const r=validateWorld(w);
  assert.equal(r.ok,false);
  assert.ok(r.errors.some(s=>s.includes('multiple times')));
});
