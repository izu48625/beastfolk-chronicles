import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ui/previewApp.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('browser has officer stats discovery entry',()=>{
  assert.match(html,/data-tab="officers"[^>]*>武将能力</);
  assert.match(app,/function officerDetailInfo\(/);
  assert.match(app,/officerDetail:officerDetailInfo/);
});
test('region, roster, reserves and nominees link into officer dossier',()=>{
  assert.match(app,/data-officer/);
  assert.match(app,/data-candidate-detail/);
  assert.match(app,/getCandidateProfile\(world,selectedOfficer\.id\)/);
  assert.match(app,/getOfficerProfile\(world,selectedOfficer\.id\)/);
  assert.match(app,/data-officer-back/);
});
test('five ability names and all three role fits displayed',()=>{
  for(const stat of ['martial','command','intellect','administration','diplomacy'])assert.match(app,new RegExp(stat+':'));
  assert.match(app,/p\.fits/);
  assert.match(app,/officerFitness/);
});
