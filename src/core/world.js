import { SCHEMA_VERSION } from './constants.js';
import { assertSeed } from './rng.js';
import { SAMPLE_WORLD_DATA } from './sampleWorld.js';
import { validateWorld } from './validation.js';
import {initializeOfficerSystem} from '../systems/officers.js';

/** JSON-compatible, deterministic deep copy. WorldState intentionally carries no methods. */
export function cloneWorld(world) { return JSON.parse(JSON.stringify(world)); }

/**
 * P0 seed-world factory. Only 'sample' supported until AI-1 supplies 50-province scenario.
 * @param {number} seed unsigned 32-bit integer, including 0
 * @param {{scenario?: 'sample'}} config
 */
export function createWorld(seed, config = {}) {
  const normalizedSeed = assertSeed(seed);
  if (config === null || typeof config !== 'object' || Array.isArray(config) || (config.scenario ?? 'sample') !== 'sample') {
    throw new TypeError('P0 supports only scenario: "sample"');
  }
  const initial = cloneWorld(SAMPLE_WORLD_DATA);
  const world = {
    schemaVersion: SCHEMA_VERSION,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    monthIndex: 0,
    ...initial,
    events: [],
    player: {mode:'observer', selectedNationId:null, pendingOrders:[]},
    nextIds: {event:1,officer:3,army:3,nation:3,order:1}
  };
  initializeOfficerSystem(world);
  const check = validateWorld(world);
  if (!check.ok) throw new Error('invalid P0 sample world: ' + check.errors.join('; '));
  return world;
}

export function totalPopulation(province) {
  return Object.values(province.populationBySpecies).reduce((a, b) => a + b, 0);
}
export function totalTroops(army) {
  return Object.values(army.troopsBySpecies).reduce((a, b) => a + b, 0);
}
export function getNationSummary(world, nationId) {
  const nation = world.nations[nationId];
  if (!nation) throw new RangeError('unknown nationId');
  const provinces = Object.values(world.provinces).filter(p => p.ownerNationId === nationId);
  const armies = Object.values(world.armies).filter(a => a.nationId === nationId);
  return {
    nationId,
    provinceCount: provinces.length,
    population: provinces.reduce((sum, p) => sum + totalPopulation(p), 0),
    armyCount: armies.length,
    troopCount: armies.reduce((sum, a) => sum + totalTroops(a), 0)
  };
}
