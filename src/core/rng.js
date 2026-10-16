/** Mulberry32 PRNG. Only this module is allowed to create simulation randomness. */
import { UINT32_MAX } from './constants.js';

export function assertSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  return seed >>> 0;
}

export function createRng(seed) {
  let state = assertSeed(seed);
  return Object.freeze({
    nextUint32() {
      state = (state + 0x6D2B79F5) >>> 0;
      let z = state;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return (z ^ (z >>> 14)) >>> 0;
    },
    nextFloat() { return this.nextUint32() / 4294967296; },
    nextInt(minInclusive, maxInclusive) {
      if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxInclusive) || minInclusive > maxInclusive) {
        throw new RangeError('invalid integer range');
      }
      const range = maxInclusive - minInclusive + 1;
      if (range <= 0 || range > 4294967296) throw new RangeError('integer range exceeds PRNG precision');
      // Rejection sampling avoids modulo bias while preserving seeded replay.
      const bound = Math.floor(4294967296 / range) * range;
      let value;
      do { value = this.nextUint32(); } while (value >= bound);
      return minInclusive + value % range;
    },
    getState() { return state; }
  });
}

export function canonicalPairKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b || a === b || a.includes('|') || b.includes('|')) {
    throw new TypeError('pair must contain two distinct valid nation IDs');
  }
  return [a, b].sort().join('|');
}
