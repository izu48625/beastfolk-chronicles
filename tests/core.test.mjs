import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, getNationSummary } from '../src/core/world.js';
import { advanceMonth } from '../src/core/engine.js';
import { createRng, canonicalPairKey } from '../src/core/rng.js';
import { validateWorld } from '../src/core/validation.js';

test('P0 sample validates and does not claim full MVP', () => {
  const w=createWorld(12345);
  assert.equal(Object.keys(w.provinces).length,4);
  assert.equal(Object.keys(w.nations).length,2);
  assert.equal(Object.keys(w.species).length,2);
  assert.deepEqual(validateWorld(w),{ok:true,errors:[]});
});
test('seed normalization rejects negatives and floats, supports zero', () => {
  assert.equal(createWorld(0).rngState,0);
  assert.throws(()=>createWorld(-1),RangeError);
  assert.throws(()=>createWorld(1.5),RangeError);
  assert.throws(()=>createWorld(4294967296),RangeError);
  assert.throws(()=>createWorld(1,{scenario:'mvp'}),/sample/);
});
test('PRNG replay and saved state replay', () => {
  const a=createRng(1984),b=createRng(1984);
  const seq=Array.from({length:50},()=>a.nextUint32());
  assert.deepEqual(seq,Array.from({length:50},()=>b.nextUint32()));
  const rng=createRng(a.getState());
  assert.equal(rng.nextUint32(),a.nextUint32());
  assert.equal(createRng(0).nextFloat()>=0,true);
  const d=createRng(7);
  for(let i=0;i<50;i++) assert.ok(d.nextInt(1,3)>=1 && d.nextInt(1,3)<=3);
});
test('canonical relation keys are direction independent',()=>{
  assert.equal(canonicalPairKey('nation_002','nation_001'),'nation_001|nation_002');
  assert.throws(()=>canonicalPairKey('a','a'));
});
test('month increments and never mutates input',()=>{
  const initial=createWorld(777);
  const before=JSON.stringify(initial);
  let w=initial;
  for(let i=0;i<40;i++) w=advanceMonth(w).world;
  assert.equal(w.monthIndex,40);
  assert.equal(JSON.stringify(initial),before);
  assert.deepEqual(validateWorld(w),{ok:true,errors:[]});
});
test('nation totals derive from provinces/armies, not cached values',()=>{
  const w=createWorld(12),s=getNationSummary(w,'nation_001');
  assert.deepEqual(s,{nationId:'nation_001',provinceCount:2,population:9600,armyCount:1,troopCount:400});
  assert.throws(()=>getNationSummary(w,'unknown'),RangeError);
});
