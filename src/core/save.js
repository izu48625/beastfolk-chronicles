import { SCHEMA_VERSION, MAX_SAVE_CHARS } from './constants.js';
import { validateWorld } from './validation.js';
import { cloneWorld } from './world.js';
import {initializeOfficerSystem} from '../systems/officers.js';

/** JSON export/import; persistence with IndexedDB is owned by AI-0 for P5. */
export function exportSave(world) {
  const validation = validateWorld(world);
  if (!validation.ok) throw new TypeError('Cannot save invalid WorldState: ' + validation.errors.slice(0,5).join('; '));
  const text = JSON.stringify(world);
  if (text.length > MAX_SAVE_CHARS) throw new RangeError('Save exceeds Phase 0 size limit');
  return text;
}
export function importSave(text) {
  if (typeof text !== 'string' || text.length > MAX_SAVE_CHARS) throw new TypeError('Save text missing or exceeds size limit');
  let state;
  try { state = JSON.parse(text); }
  catch { throw new SyntaxError('Save is not valid JSON'); }
  if (state?.schemaVersion === 1) {
    // Previously-published P0/P0.1 saves keep their nations, map, events and RNG state.
    // Fill the new slots using a separate seed; never change the saved RNG stream.
    state = cloneWorld(state);
    initializeOfficerSystem(state);
    state.schemaVersion = SCHEMA_VERSION;
  }
  if (state?.schemaVersion !== SCHEMA_VERSION) {
    throw new RangeError(`Unsupported save schemaVersion: ${state?.schemaVersion}; expected ${SCHEMA_VERSION}`);
  }
  const validation = validateWorld(state);
  if (!validation.ok) throw new TypeError('Invalid save: ' + validation.errors.slice(0,8).join('; '));
  return cloneWorld(state);
}
