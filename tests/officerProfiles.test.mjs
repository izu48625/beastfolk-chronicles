import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/core/world.js';
import {advanceMonth} from '../src/core/engine.js';
import {getOfficerProfile,getCandidateProfile} from '../src/core/officerProfiles.js';
import {OFFICER_SLOTS,officerFitness} from '../src/systems/officers.js';

test('officer profile includes all five actual personal stats and all three aptitude ratings',()=>{
  const w=createWorld(2026),id=w.provinces.province_001.slots.governor;
  const before=JSON.stringify(w),p=getOfficerProfile(w,id);
  assert.deepEqual(Object.keys(p.stats).sort(),['administration','command','diplomacy','intellect','martial']);
  assert.deepEqual(new Set(p.fits.map(f=>f.slot)),new Set(OFFICER_SLOTS));
  assert.equal(p.fits.length,3);
  assert.equal(p.bestSlot,p.fits[0].slot);
  assert.ok(p.fits.every(f=>f.fitness>=0 && f.fitness<=100));
  assert.deepEqual(p.assignment,{provinceId:'province_001',slot:'governor'});
  assert.equal(p.role,'ruler');
  assert.equal(JSON.stringify(w),before);
});
test('candidate details distinguish nominated but not yet hired people',()=>{
  let w=createWorld(42);
  w.player.mode='intervention';w.player.selectedNationId='nation_001';
  for(let i=0;i<12;i++)w=advanceMonth(w).world;
  const candidate=Object.values(w.officerCandidates).find(c=>c.nationId==='nation_001');
  assert.ok(candidate);
  const before=JSON.stringify(w),p=getCandidateProfile(w,candidate.id);
  assert.equal(p.kind,'candidate');assert.equal(p.status,'candidate');
  assert.equal(p.nameJa,candidate.nameJa);
  assert.equal(p.nationNameJa,w.nations.nation_001.nameJa);
  assert.equal(p.assignment,null);assert.equal(p.year,1);
  assert.deepEqual(Object.keys(p.stats).sort(),['administration','command','diplomacy','intellect','martial']);
  assert.equal(JSON.stringify(w),before);
});
test('profile reflects real appointment changes and history, not cached state',()=>{
  let w=createWorld(13);const id=w.provinces.province_002.slots.advisor;
  w.player.mode='intervention';w.player.selectedNationId='nation_001';
  const order={id:'order_move',issuer:'player',nationId:'nation_001',type:'assign_officer',targetProvinceId:'province_001',
    params:{officerId:id,slot:'military'},submittedMonth:0};
  const result=advanceMonth(w,[order]);assert.equal(result.rejectedOrders.length,0);
  w=result.world;const p=getOfficerProfile(w,id);
  assert.deepEqual(p.assignment,{provinceId:'province_001',slot:'military'});
  assert.ok(p.events.some(e=>e.type==='officer_assigned'));
  assert.equal(p.events[0].summaryJa.includes(p.nameJa),true);
  assert.equal(p.fits.find(f=>f.slot==='military').fitness,Math.round(officerFitness(w.officers[id],'military')*10)/10);
});
test('profiles reject missing IDs and do not fake lifetime accomplishments',()=>{
  const w=createWorld(7);
  assert.throws(()=>getOfficerProfile(w,'missing'),RangeError);
  assert.throws(()=>getCandidateProfile(w,'missing'),RangeError);
  const p=getOfficerProfile(w,w.provinces.province_001.slots.governor);
  assert.deepEqual(p.events,[]);
});
