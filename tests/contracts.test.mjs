import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, cloneWorld } from '../src/core/world.js';
import { validateWorld } from '../src/core/validation.js';

function fails(mutator,fragment) {
  const w=createWorld(100);mutator(w);
  const r=validateWorld(w);
  assert.equal(r.ok,false,'mutation must invalidate WorldState');
  assert.ok(r.errors.some(e=>e.includes(fragment)),`expected ${fragment}; found ${r.errors.join('; ')}`);
}
test('unknown neighbor rejected',()=>fails(w=>{w.provinces.province_001.neighbors.push('province_999');},'neighbors'));
test('asymmetric neighbor rejected',()=>fails(w=>{w.provinces.province_002.neighbors=[];},'adjacency'));
test('unknown species population rejected',()=>fails(w=>{w.provinces.province_001.populationBySpecies.dragon=1;},'unknown species'));
test('NaN, Infinity and negative economy rejected',()=>{
  fails(w=>{w.nations.nation_001.treasury=NaN;},'treasury');
  fails(w=>{w.nations.nation_001.food=Infinity;},'food');
  fails(w=>{w.nations.nation_001.materials=-1;},'materials');
});
test('living capital cannot belong to different nation',()=>fails(w=>{w.nations.nation_001.capitalProvinceId='province_004';},'capitalProvinceId'));
test('dead commander cannot lead an army',()=>fails(w=>{w.officers.officer_001.alive=false;w.officers.officer_001.role='unassigned';},'commanderId'));
test('army location must agree with garrison',()=>fails(w=>{w.armies.army_001.provinceId='province_001';},'garrison'));
test('relations sorted and canonical',()=>fails(w=>{w.relations['nation_001|nation_002'].nationAId='nation_002';},'relations'));
test('extinct nation cannot own territory',()=>fails(w=>{w.nations.nation_001.alive=false;},'extinct'));
test('history events must reference real records',()=>fails(w=>{w.events.push({id:'event_x',monthIndex:0,type:'battle',nationIds:['unknown'],provinceIds:[],officerIds:[],speciesIds:[],payload:{},summaryJa:'誤記録'});},'unknown references'));
test('world cloning works and no shared object mutations',()=>{
  const first=createWorld(1),copy=cloneWorld(first);
  copy.provinces.province_001.publicOrder=0;
  assert.notEqual(first.provinces.province_001.publicOrder,copy.provinces.province_001.publicOrder);
});
