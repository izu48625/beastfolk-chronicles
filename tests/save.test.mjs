import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { advanceMonth } from '../src/core/engine.js';
import { exportSave, importSave } from '../src/core/save.js';

test('save -> load yields byte-identical JSON state',()=>{
  let w=createWorld(8);
  for(let i=0;i<15;i++) w=advanceMonth(w).world;
  const text=exportSave(w);
  assert.equal(JSON.stringify(importSave(text)),JSON.stringify(w));
});
test('save -> load -> replay matches uninterrupted simulation',()=>{
  let a=createWorld(123456),b=createWorld(123456);
  for(let i=0;i<12;i++) a=advanceMonth(a).world;
  b=importSave(exportSave(a));
  for(let i=0;i<30;i++) {a=advanceMonth(a).world;b=advanceMonth(b).world;}
  assert.deepEqual(a,b);
});
test('corrupt saves and schema mismatches are rejected',()=>{
  assert.throws(()=>importSave('{bad'),SyntaxError);
  const w=createWorld(9);w.schemaVersion=999;
  assert.throws(()=>importSave(JSON.stringify(w)),/Unsupported save schemaVersion/);
  const bad=createWorld(9);bad.nations.nation_001.treasury=-1;
  assert.throws(()=>exportSave(bad),/invalid WorldState/);
  assert.throws(()=>importSave(JSON.stringify(bad)),/Invalid save/);
});
