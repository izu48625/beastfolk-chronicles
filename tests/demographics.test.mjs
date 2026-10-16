import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld, cloneWorld} from '../src/core/world.js';
import {getNationDemographics, getSpeciesDemographics} from '../src/core/demographics.js';
import {advanceMonth} from '../src/core/engine.js';
import {exportSave, importSave} from '../src/core/save.js';

test('nation demographics: civilians and soldiers are counted once',()=>{
  const w=createWorld(12345),a=getNationDemographics(w,'nation_001'),b=getNationDemographics(w,'nation_002');
  assert.deepEqual([a.civilians,a.military,a.total,a.provinceCount],[9600,400,10000,2]);
  assert.deepEqual([b.civilians,b.military,b.total,b.provinceCount],[9700,400,10100,2]);
  assert.equal(a.speciesRows.reduce((sum,r)=>sum+r.total,0),a.total);
  assert.equal(b.speciesRows.reduce((sum,r)=>sum+r.total,0),b.total);
  assert.equal(a.regionRows.reduce((sum,r)=>sum+r.total,0),a.total);
  assert.equal(b.regionRows.reduce((sum,r)=>sum+r.total,0),b.total);
});
test('nation breakdown correctly splits species & military cohorts',()=>{
  const w=createWorld(1),d=getNationDemographics(w,'nation_001');
  assert.deepEqual(d.speciesRows.map(x=>[x.speciesId,x.civilians,x.military,x.total]),[
    ['bear_brown',6000,300,6300],['dog_shiba',3600,100,3700]
  ]);
  assert.deepEqual(d.regionRows.map(r=>[r.provinceId,r.civilians,r.military]),[
    ['province_002',5000,400],['province_001',4600,0]
  ]);
  assert.equal(d.speciesRows.reduce((s,r)=>s+r.percent,0),100);
});
test('world species counts reconcile to all nation populations',()=>{
  const w=createWorld(1),a=getSpeciesDemographics(w,'dog_shiba'),b=getSpeciesDemographics(w,'bear_brown');
  assert.deepEqual([a.civilians,a.military,a.total],[10900,450,11350]);
  assert.deepEqual([b.civilians,b.military,b.total],[8400,350,8750]);
  assert.equal(a.total+b.total,20100);
  assert.deepEqual(a.nationRows.map(x=>[x.nationId,x.civilians,x.military]),[
    ['nation_002',7300,350],['nation_001',3600,100]
  ]);
});
test('reports are derived, not cached and do not mutate input',()=>{
  const w=createWorld(1);
  const before=JSON.stringify(w);
  getNationDemographics(w,'nation_001');getSpeciesDemographics(w,'dog_shiba');
  assert.equal(JSON.stringify(w),before);
  const next=cloneWorld(w);
  next.provinces.province_001.populationBySpecies.bear_brown+=200;
  next.armies.army_001.troopsBySpecies.dog_shiba+=50;
  assert.equal(getNationDemographics(next,'nation_001').total,10250);
  assert.equal(getSpeciesDemographics(next,'dog_shiba').total,11400);
  assert.equal(getNationDemographics(w,'nation_001').total,10000);
});
test('moving civilians to troops does not create new population',()=>{
  const w=createWorld(2);
  w.provinces.province_002.populationBySpecies.dog_shiba-=100;
  w.armies.army_001.troopsBySpecies.dog_shiba+=100;
  const n=getNationDemographics(w,'nation_001'),s=getSpeciesDemographics(w,'dog_shiba');
  assert.deepEqual([n.civilians,n.military,n.total],[9500,500,10000]);
  assert.deepEqual([s.civilians,s.military,s.total],[10800,550,11350]);
});
test('reports survive save/load and month progression',()=>{
  const w=createWorld(3);
  const w2=importSave(exportSave(advanceMonth(w).world));
  assert.deepEqual(getNationDemographics(w,'nation_001'),getNationDemographics(w2,'nation_001'));
  assert.deepEqual(getSpeciesDemographics(w,'dog_shiba'),getSpeciesDemographics(w2,'dog_shiba'));
  assert.throws(()=>getNationDemographics(w,'not_a_nation'),RangeError);
  assert.throws(()=>getSpeciesDemographics(w,'not_a_species'),RangeError);
});
