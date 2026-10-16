/** P0: canonical enums and safety ceilings. Changes require an interfaces.md revision. */
export const SCHEMA_VERSION = 1;
export const STAT_KEYS = Object.freeze(['dom', 'eco', 'pow', 'def', 'mob', 'rec', 'log', 'dip']);
export const OFFICER_STAT_KEYS = Object.freeze(['martial', 'command', 'intellect', 'administration', 'diplomacy']);
export const STRATEGIES = Object.freeze(['expansion', 'domestic', 'trade', 'defense', 'diplomacy', 'balanced']);
export const GOVERNMENTS = Object.freeze(['tribe', 'kingdom', 'republic', 'federation']);
export const TERRAINS = Object.freeze(['plains', 'forest', 'hills', 'mountains', 'wetlands', 'snowfields', 'coast']);
export const CLIMATES = Object.freeze(['cold', 'temperate', 'hot', 'arid']);
export const DIETS = Object.freeze(['herbivore', 'carnivore', 'omnivore']);
export const OFFICER_ROLES = Object.freeze(['ruler', 'general', 'administrator', 'diplomat', 'scout', 'unassigned']);
export const ORDER_TYPES = Object.freeze([
  'set_strategy', 'develop_agriculture', 'develop_commerce', 'fortify',
  'recruit', 'research', 'move_army', 'declare_war', 'attack', 'offer_peace',
  'propose_alliance', 'trade_agreement'
]);
export const IMPLEMENTED_P0_ORDERS = Object.freeze(['set_strategy']);
export const MAX_RESOURCE = 1_000_000_000_000;
export const MAX_POPULATION = 1_000_000_000_000;
export const MAX_EVENTS = 2_000_000;
export const MAX_SAVE_CHARS = 64 * 1024 * 1024;
export const UINT32_MAX = 0xffffffff;
