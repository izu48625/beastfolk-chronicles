import { cloneWorld } from './world.js';
import { createRng } from './rng.js';
import { validateWorld } from './validation.js';
import { resolveOrders } from './orders.js';
import {processAnnualOfficers} from '../systems/officers.js';

/**
 * P0-only monthly engine. Does NOT pretend that the AI/economy/combat systems exist.
 * Returns a new state, per-turn events, acceptance/rejection details.
 * Ordering contract (P2-P4): environment -> economy -> population -> AI proposals
 * -> officers -> order resolution -> diplomacy -> military -> nation transitions -> history.
 */
export function advanceMonth(world, playerOrders = []) {
  const before = validateWorld(world);
  if (!before.ok) throw new TypeError(`Invalid WorldState: ${before.errors.slice(0,5).join('; ')}`);
  if (!Array.isArray(playerOrders)) throw new TypeError('playerOrders must be an array');
  const next = cloneWorld(world);
  const rng = createRng(next.rngState);
  // P0 has no AI-generated orders; this changes when AI-3 joins the engine.
  const {events,acceptedOrders,rejectedOrders} = resolveOrders(next, playerOrders, rng);
  next.events.push(...events);
  next.monthIndex += 1;
  processAnnualOfficers(next,rng);
  next.rngState = rng.getState();
  next.player.pendingOrders = [];
  const after = validateWorld(next);
  if (!after.ok) throw new Error(`Engine invariant failure: ${after.errors.slice(0,5).join('; ')}`);
  return {world: next, events, acceptedOrders, rejectedOrders};
}
