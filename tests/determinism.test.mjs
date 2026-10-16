import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { advanceMonth } from '../src/core/engine.js';
import { exportSave, importSave } from '../src/core/save.js';

function run(seed,saveAt=null) {
  let world=createWorld(seed);
  for(let month=0;month<72;month++) {
    let commands=[];
    if(month%9===0) commands.push({id:`order_${month}`,issuer:'ai',nationId:'nation_001',
      type:'set_strategy',params:{strategy:month%18===0?'expansion':'defense'},submittedMonth:month});
    world=advanceMonth(world,commands).world;
    if(month===saveAt) world=importSave(exportSave(world));
  }
  return world;
}

test('10 seeds x 72 months identical with mid-course save/reload',()=>{
  for(let seed=0;seed<10;seed++) assert.deepEqual(run(seed),run(seed,35));
});
test('world progress and history independent of initial JSON record object identity',()=>{
  assert.deepEqual(run(123),run(123));
});
