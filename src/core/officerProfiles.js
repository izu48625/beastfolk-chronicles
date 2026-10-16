// Pure read-only officer profiles for roster, candidates and province UI.
// No state mutation, no estimated feats, no fabricated statistics.
import {OFFICER_SLOTS,officerAssignment,officerFitness} from '../systems/officers.js';
const copy=o=>JSON.parse(JSON.stringify(o));
function assessment(person){
  const fits=OFFICER_SLOTS.map(slot=>({slot,fitness:Math.round(officerFitness(person,slot)*10)/10}));
  fits.sort((a,b)=>b.fitness-a.fitness || OFFICER_SLOTS.indexOf(a.slot)-OFFICER_SLOTS.indexOf(b.slot));
  return {fits,bestSlot:fits[0].slot,stats:copy(person.stats)};
}
export function getOfficerProfile(world,id){
  const o=world.officers[id];
  if(!o)throw new RangeError('unknown officerId');
  const assignment=officerAssignment(world,id);
  const commands=Object.values(world.armies).filter(a=>a.commanderId===id).map(a=>a.id).sort();
  const events=world.events.filter(e=>Array.isArray(e.officerIds)&&e.officerIds.includes(id))
    .slice(-8).reverse().map(e=>({id:e.id,monthIndex:e.monthIndex,type:e.type,summaryJa:e.summaryJa}));
  return {
    kind:'officer',id:o.id,nameJa:o.nameJa,
    nationId:o.nationId,nationNameJa:world.nations[o.nationId]?.nameJa??'無所属',
    speciesId:o.speciesId,speciesNameJa:world.species[o.speciesId]?.nameJa??o.speciesId,
    age:o.age,loyalty:o.loyalty,experience:o.experience,
    role:o.role,status:o.status,alive:o.alive,
    traits:copy(o.traits),assignment,armyIds:commands,events,...assessment(o)
  };
}
export function getCandidateProfile(world,id){
  const o=world.officerCandidates[id];
  if(!o)throw new RangeError('unknown candidateId');
  return {
    kind:'candidate',id:o.id,nameJa:o.nameJa,
    nationId:o.nationId,nationNameJa:world.nations[o.nationId]?.nameJa??'無所属',
    speciesId:o.speciesId,speciesNameJa:world.species[o.speciesId]?.nameJa??o.speciesId,
    age:o.age,loyalty:o.loyalty,experience:o.experience,year:o.year,
    role:'candidate',status:'candidate',alive:true,
    traits:copy(o.traits),assignment:null,armyIds:[],events:[],...assessment(o)
  };
}
