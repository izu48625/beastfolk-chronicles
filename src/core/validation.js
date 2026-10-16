import {
  SCHEMA_VERSION, STAT_KEYS, OFFICER_STAT_KEYS, GOVERNMENTS, STRATEGIES,
  TERRAINS, CLIMATES, DIETS, OFFICER_ROLES, MAX_RESOURCE, MAX_POPULATION,
  MAX_EVENTS, UINT32_MAX
} from './constants.js';
import { canonicalPairKey } from './rng.js';

// Returns every detected failure instead of throwing on ordinary user save data.
export function validateWorld(world) {
  const errors = [];
  const fail = (path, reason) => errors.push(`${path}: ${reason}`);
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = (value,min,max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const integer = (value,min,max) => Number.isSafeInteger(value) && value >= min && value <= max;
  const str = value => typeof value === 'string' && value.length > 0;
  const array = Array.isArray;
  const record = (value,path) => {
    if (!obj(value)) {fail(path,'must be a record'); return {}; }
    return value;
  };
  const requireValue = (value,path,predicate,description) => {if (!predicate(value)) fail(path,description);};
  const checkPercentage = (value,path) => requireValue(value,path,v=>finite(v,0,100),'must be 0..100 finite');
  const checkResource = (value,path) => requireValue(value,path,v=>finite(v,0,MAX_RESOURCE),'must be non-negative finite resource');
  const mapEntries = (r) => Object.entries(r);

  if (!obj(world)) return {ok:false,errors:['world: must be an object']};
  requireValue(world.schemaVersion,'schemaVersion',v=>v===SCHEMA_VERSION,`must be ${SCHEMA_VERSION}`);
  requireValue(world.seed,'seed',v=>integer(v,0,UINT32_MAX),'must be uint32');
  requireValue(world.rngState,'rngState',v=>integer(v,0,UINT32_MAX),'must be uint32');
  requireValue(world.monthIndex,'monthIndex',v=>integer(v,0,Number.MAX_SAFE_INTEGER),'must be non-negative safe integer');
  const species = record(world.species,'species');
  const provinces = record(world.provinces,'provinces');
  const nations = record(world.nations,'nations');
  const officers = record(world.officers,'officers');
  const armies = record(world.armies,'armies');
  const relations = record(world.relations,'relations');
  const garrisonSeen = new Set();

  for (const [id,s] of mapEntries(species)) {
    const path=`species.${id}`;
    if (!obj(s)) {fail(path,'must be an object'); continue;}
    if (s.id!==id) fail(`${path}.id`,'key/id mismatch');
    for (const k of ['nameJa','familyId','animalSpeciesId']) requireValue(s[k],`${path}.${k}`,str,'must be nonempty string');
    if (s.varietyId!==null && s.varietyId!==undefined && !str(s.varietyId)) fail(`${path}.varietyId`,'must be string or null');
    if (!DIETS.includes(s.diet)) fail(`${path}.diet`,'unknown diet');
    const stats=record(s.stats,`${path}.stats`);
    for (const key of STAT_KEYS) checkPercentage(stats[key],`${path}.stats.${key}`);
    if (!array(s.traits) || s.traits.some(t=>!str(t))) fail(`${path}.traits`,'must be string[]');
    const ec=record(s.ecology,`${path}.ecology`);
    checkPercentage(ec.size,`${path}.ecology.size`);
    requireValue(ec.foodDemand,`${path}.ecology.foodDemand`,v=>finite(v,0,100),'must be nonnegative finite');
    requireValue(ec.lifespan,`${path}.ecology.lifespan`,v=>integer(v,1,300),'must be integer 1..300');
    requireValue(ec.maturityAge,`${path}.ecology.maturityAge`,v=>integer(v,0,300),'must be integer 0..300');
    requireValue(ec.birthRate,`${path}.ecology.birthRate`,v=>finite(v,0,10),'must be finite 0..10');
    if (!array(ec.preferredBiomes) || ec.preferredBiomes.some(t=>!TERRAINS.includes(t))) fail(`${path}.ecology.preferredBiomes`,'unknown terrain');
  }

  for (const [id,n] of mapEntries(nations)) {
    const path=`nations.${id}`;
    if (!obj(n)) {fail(path,'must be an object');continue;}
    if (n.id!==id) fail(`${path}.id`,'key/id mismatch');
    requireValue(n.nameJa,`${path}.nameJa`,str,'required');
    if (typeof n.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(n.color)) fail(`${path}.color`,'must be #RRGGBB');
    if (!GOVERNMENTS.includes(n.government)) fail(`${path}.government`,'unknown government');
    if (!STRATEGIES.includes(n.strategy)) fail(`${path}.strategy`,'unknown strategy');
    if (typeof n.alive!=='boolean') fail(`${path}.alive`,'must be boolean');
    checkResource(n.treasury,`${path}.treasury`);
    checkResource(n.food,`${path}.food`);
    checkResource(n.materials,`${path}.materials`);
    checkPercentage(n.stability,`${path}.stability`);
    requireValue(n.foundedMonth,`${path}.foundedMonth`,v=>integer(v,0,world.monthIndex),'must be valid past month');
    const tech=record(n.tech,`${path}.tech`);
    for (const k of ['agriculture','industry','military','medicine']) requireValue(tech[k],`${path}.tech.${k}`,v=>integer(v,0,100),'must be 0..100 integer');
    if (n.alive) {
      if (!provinces[n.capitalProvinceId] || provinces[n.capitalProvinceId]?.ownerNationId!==id) fail(`${path}.capitalProvinceId`,'living nation must own capital');
      const ruler=officers[n.rulerOfficerId];
      if (!ruler || !ruler.alive || ruler.nationId!==id || ruler.role!=='ruler') fail(`${path}.rulerOfficerId`,'living nation must have living ruler of same nation');
    }
  }

  for (const [id,p] of mapEntries(provinces)) {
    const path=`provinces.${id}`;
    if (!obj(p)) {fail(path,'must be object');continue;}
    if (p.id!==id) fail(`${path}.id`,'key/id mismatch');
    requireValue(p.nameJa,`${path}.nameJa`,str,'required');
    if (p.ownerNationId!==null && !nations[p.ownerNationId]) fail(`${path}.ownerNationId`,'unknown nation');
    if (p.ownerNationId!==null && nations[p.ownerNationId]?.alive===false) fail(`${path}.ownerNationId`,'extinct nation owns territory');
    if (!TERRAINS.includes(p.terrain)) fail(`${path}.terrain`,'unknown terrain');
    if (!CLIMATES.includes(p.climate)) fail(`${path}.climate`,'unknown climate');
    if (!array(p.neighbors) || p.neighbors.some(v=>!str(v))) fail(`${path}.neighbors`,'must be ID array');
    else {
      if (new Set(p.neighbors).size!==p.neighbors.length) fail(`${path}.neighbors`,'duplicates');
      for (const other of p.neighbors) {
        if (other===id || !provinces[other]) fail(`${path}.neighbors`,'self/unknown neighbor');
        else if (!array(provinces[other].neighbors) || !provinces[other].neighbors.includes(id)) fail(`${path}.neighbors`,'adjacency must be symmetric');
      }
    }
    const pop=record(p.populationBySpecies,`${path}.populationBySpecies`);
    for (const [type,amount] of mapEntries(pop)) {
      if (!species[type]) fail(`${path}.populationBySpecies.${type}`,'unknown species');
      if (!integer(amount,0,MAX_POPULATION)) fail(`${path}.populationBySpecies.${type}`,'must be non-negative integer');
    }
    for (const k of ['agriculture','commerce','development','publicOrder','foodPotential','materialPotential']) checkPercentage(p[k],`${path}.${k}`);
    requireValue(p.fortLevel,`${path}.fortLevel`,v=>integer(v,0,100),'must be 0..100 integer');
    if (!array(p.garrisonArmyIds)) fail(`${path}.garrisonArmyIds`,'must be army ID array');
    else for (const armyId of p.garrisonArmyIds) {
      if (garrisonSeen.has(armyId)) fail(`${path}.garrisonArmyIds`,'army appears in multiple garrisons');
      garrisonSeen.add(armyId);
      if (!armies[armyId]) fail(`${path}.garrisonArmyIds`,'unknown army');
      else if (armies[armyId]?.provinceId!==id) fail(`${path}.garrisonArmyIds`,'army province mismatch');
    }
  }

  for (const [id,o] of mapEntries(officers)) {
    const path=`officers.${id}`;
    if (!obj(o)) {fail(path,'must be object');continue;}
    if (o.id!==id) fail(`${path}.id`,'key/id mismatch');
    if (!species[o.speciesId]) fail(`${path}.speciesId`,'unknown species');
    if (o.nationId!==null && !nations[o.nationId]) fail(`${path}.nationId`,'unknown nation');
    if (!OFFICER_ROLES.includes(o.role)) fail(`${path}.role`,'unknown role');
    requireValue(o.nameJa,`${path}.nameJa`,str,'required');
    requireValue(o.age,`${path}.age`,v=>integer(v,0,300),'must be integer 0..300');
    checkPercentage(o.loyalty,`${path}.loyalty`);
    checkResource(o.experience,`${path}.experience`);
    if (typeof o.alive!=='boolean') fail(`${path}.alive`,'must be boolean');
    if (!o.alive && o.role!=='unassigned') fail(`${path}.role`,'deceased officer must be unassigned');
    if (!array(o.traits) || o.traits.some(t=>!str(t))) fail(`${path}.traits`,'must be string[]');
    const stats=record(o.stats,`${path}.stats`);
    for (const key of OFFICER_STAT_KEYS) checkPercentage(stats[key],`${path}.stats.${key}`);
  }

  for (const [id,a] of mapEntries(armies)) {
    const path=`armies.${id}`;
    if (!obj(a)) {fail(path,'must be object');continue;}
    if (a.id!==id) fail(`${path}.id`,'key/id mismatch');
    if (!nations[a.nationId]?.alive) fail(`${path}.nationId`,'unknown/extinct nation');
    if (!provinces[a.provinceId]) fail(`${path}.provinceId`,'unknown province');
    if (a.targetProvinceId!==null && !provinces[a.targetProvinceId]) fail(`${path}.targetProvinceId`,'unknown target');
    if (!garrisonSeen.has(id)) fail(`${path}.provinceId`,'army missing from province garrison list');
    if (!officers[a.commanderId]?.alive || officers[a.commanderId]?.nationId!==a.nationId) fail(`${path}.commanderId`,'commander must be living and from same nation');
    const troops=record(a.troopsBySpecies,`${path}.troopsBySpecies`);
    for (const [type,amount] of mapEntries(troops)) {
      if (!species[type]) fail(`${path}.troopsBySpecies.${type}`,'unknown species');
      if (!integer(amount,0,MAX_POPULATION)) fail(`${path}.troopsBySpecies.${type}`,'must be non-negative integer');
    }
    checkPercentage(a.morale,`${path}.morale`);
    checkPercentage(a.supply,`${path}.supply`);
  }

  for (const [key,r] of mapEntries(relations)) {
    const path=`relations.${key}`;
    if (!obj(r)) {fail(path,'must be object');continue;}
    try {if (canonicalPairKey(r.nationAId,r.nationBId)!==key || r.nationAId>r.nationBId) fail(path,'must use sorted canonical pair IDs');}
    catch {fail(path,'invalid nation pair');}
    if (!nations[r.nationAId] || !nations[r.nationBId]) fail(path,'references unknown nation');
    requireValue(r.score,`${path}.score`,v=>finite(v,-100,100),'must be -100..100 finite');
    for (const k of ['atWar','allied','tradeAgreement']) if (typeof r[k]!=='boolean') fail(`${path}.${k}`,'must be boolean');
    if (r.atWar && r.allied) fail(path,'war and alliance cannot coexist');
    if (r.truceUntilMonth!==null && !integer(r.truceUntilMonth,0,Number.MAX_SAFE_INTEGER)) fail(`${path}.truceUntilMonth`,'must be month index or null');
  }

  if (!array(world.events)) fail('events','must be HistoryEvent[]');
  else {
    if (world.events.length>MAX_EVENTS) fail('events','event cap exceeded');
    const eventIds=new Set();let prev=-1;
    for (let i=0;i<world.events.length;i++) {
      const e=world.events[i],path=`events[${i}]`;
      if (!obj(e)) {fail(path,'must be object');continue;}
      if (!str(e.id) || eventIds.has(e.id)) fail(`${path}.id`,'missing/duplicate ID');
      eventIds.add(e.id);
      if (!integer(e.monthIndex,0,world.monthIndex) || e.monthIndex<prev) fail(`${path}.monthIndex`,'must be chronological valid month');
      else prev=e.monthIndex;
      if (!str(e.type) || !str(e.summaryJa) || !obj(e.payload)) fail(path,'missing type, summary or payload');
      for (const [key,records] of [['nationIds',nations],['provinceIds',provinces],['officerIds',officers],['speciesIds',species]]) {
        if (!array(e[key]) || e[key].some(v=>!records[v])) fail(`${path}.${key}`,'unknown references');
      }
    }
  }

  const player=record(world.player,'player');
  if (!['observer','intervention'].includes(player.mode)) fail('player.mode','must be observer or intervention');
  if (player.selectedNationId!==null && !nations[player.selectedNationId]) fail('player.selectedNationId','unknown nation');
  if (player.mode==='intervention' && !nations[player.selectedNationId]?.alive) fail('player.selectedNationId','intervention requires living nation');
  if (!array(player.pendingOrders)) fail('player.pendingOrders','must be array');
  const nextIds=record(world.nextIds,'nextIds');
  for (const k of ['event','officer','army','nation','order']) requireValue(nextIds[k],`nextIds.${k}`,v=>integer(v,1,Number.MAX_SAFE_INTEGER),'must be positive safe integer');
  for (const [id,n] of mapEntries(nations)) {
    const territories=Object.values(provinces).filter(p=>p?.ownerNationId===id).length;
    if (n?.alive && !territories) fail(`nations.${id}`,'living nation owns no provinces');
    if (n?.alive===false && territories) fail(`nations.${id}`,'extinct nation still owns provinces');
  }
  return {ok:errors.length===0,errors};
}
