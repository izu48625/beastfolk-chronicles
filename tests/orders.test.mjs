import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/core/world.js';
import { advanceMonth } from '../src/core/engine.js';
import { validateOrder } from '../src/core/orders.js';
import { validateWorld } from '../src/core/validation.js';

function order(overrides={}) {return {id:'order_001',issuer:'player',nationId:'nation_001',type:'set_strategy',params:{strategy:'expansion'},submittedMonth:0,...overrides};}
function interventionWorld() {const w=createWorld(5);w.player.mode='intervention';w.player.selectedNationId='nation_001';return w;}
test('observer cannot issue player orders',()=>{
  const w=createWorld(5);
  assert.equal(validateOrder(w,order()).code,'NO_PLAYER_CONTROL');
});
test('intervention applies policy, creates factual event, input not modified',()=>{
  const before=interventionWorld();
  const next=advanceMonth(before,[order()]);
  assert.equal(before.nations.nation_001.strategy,'balanced');
  assert.equal(next.world.nations.nation_001.strategy,'expansion');
  assert.equal(next.events.length,1);
  assert.equal(next.events[0].type,'strategy_changed');
  assert.deepEqual(next.events[0].payload,{from:'balanced',to:'expansion',issuer:'player'});
  assert.equal(next.world.monthIndex,1);
  assert.equal(next.acceptedOrders.length,1);
  assert.deepEqual(validateWorld(next.world),{ok:true,errors:[]});
});
test('unsupported combat command explicitly rejected, not silently accepted',()=>{
  const w=interventionWorld();
  const result=advanceMonth(w,[order({type:'attack',params:{armyId:'army_001'},targetProvinceId:'province_003'})]);
  assert.equal(result.acceptedOrders.length,0);
  assert.equal(result.rejectedOrders[0].code,'NOT_IMPLEMENTED');
});
test('player commands target only intervention-selected nation',()=>{
  const w=interventionWorld();
  assert.equal(validateOrder(w,order({nationId:'nation_002'})).code,'NO_PLAYER_CONTROL');
});
test('wrong turn and invalid strategy refused',()=>{
  const w=interventionWorld();
  assert.equal(validateOrder(w,order({submittedMonth:4})).code,'WRONG_MONTH');
  assert.equal(validateOrder(w,order({params:{strategy:'whatever'}})).code,'INVALID_STRATEGY');
});
test('duplicate command ID and overlapping strategy commands are rejected',()=>{
  const w=interventionWorld();
  const a=order(),b=order({params:{strategy:'trade'}}),c=order({id:'order_002',params:{strategy:'defense'}});
  const r=advanceMonth(w,[a,b,c]);
  assert.equal(r.acceptedOrders.length,1);
  assert.deepEqual(r.rejectedOrders.map(x=>x.code),['DUPLICATE_ID','ORDER_CONFLICT']);
});
test('player policy overrides competing AI policy regardless of submission order',()=>{
  const w=interventionWorld();
  const ai=order({id:'order_ai',issuer:'ai',params:{strategy:'trade'}});
  const player=order({id:'order_player',params:{strategy:'expansion'}});
  const r=advanceMonth(w,[ai,player]);
  assert.equal(r.world.nations.nation_001.strategy,'expansion');
  assert.equal(r.rejectedOrders[0].code,'ORDER_CONFLICT');
});
test('AI may set strategy even in observer mode',()=>{
  const w=createWorld(8),o=order({issuer:'ai'});
  assert.equal(advanceMonth(w,[o]).world.nations.nation_001.strategy,'expansion');
});
