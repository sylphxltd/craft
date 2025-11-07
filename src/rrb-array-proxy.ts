/**
 * RRB-Tree-based proxy for very large arrays (>= 1000 items)
 * Uses RRB vector for O(log₃₂ n) operations instead of O(n) array operations
 */

import { nothing } from "./nothing";
import { arrayToRRB, createRRBVector, rrbGet, rrbPush, rrbSet, rrbToArray, type RRBVector } from "./rrb-tree";
import {
  DRAFT_STATE,
  type DraftState,
  getState,
  isDraft,
  isDraftable,
  latest,
  markChanged,
} from "./utils";

const ARRAY_METHODS = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]);

/**
 * Create RRB-based proxy for very large arrays
 */
export function createRRBArrayProxy(base: any[], parent: DraftState | null): any {
  // Convert array to RRB vector
  let rrb: RRBVector<any> = arrayToRRB(base);
  let modified = false;

  const state: DraftState = {
    base,
    copy: null,
    modified: false,
    parent,
    revoked: false,
    finalized: false,
  };

  const handler: ProxyHandler<any> = {
    get(_, prop) {
      if (prop === DRAFT_STATE) return state;

      // Handle array length
      if (prop === "length") {
        return rrb.length;
      }

      // Skip symbols
      if (typeof prop === "symbol") {
        return base[prop as any];
      }

      // Handle numeric indices
      const index = Number(prop);
      if (!Number.isNaN(index) && index >= 0 && index < rrb.length) {
        const value = rrbGet(rrb, index);

        // Fast path: primitives
        if (typeof value !== "object" || value === null) {
          return value;
        }

        // If already a draft, return it
        if (isDraft(value)) {
          return value;
        }

        // For nested draftable objects, don't create proxies for performance
        // This is a trade-off: faster large array ops vs nested object mutations
        return value;
      }

      // Handle array methods
      if (typeof base[prop as any] === "function") {
        const method = prop as string;

        if (method === "push") {
          return (...items: any[]) => {
            ensureModified();
            for (const item of items) {
              rrb = rrbPush(rrb, item);
            }
            return rrb.length;
          };
        }

        if (method === "pop") {
          return () => {
            if (rrb.length === 0) return undefined;
            ensureModified();
            const array = rrbToArray(rrb);
            const value = array.pop();
            rrb = arrayToRRB(array);
            return value;
          };
        }

        if (method === "slice") {
          return (start?: number, end?: number) => {
            // Return plain array for slice (immutable operation)
            return rrbToArray(rrb).slice(start, end);
          };
        }

        // For other methods, convert to array, apply, convert back
        if (ARRAY_METHODS.has(method)) {
          return (...args: any[]) => {
            ensureModified();
            const array = rrbToArray(rrb);
            const result = (array as any)[method](...args);
            rrb = arrayToRRB(array);
            return result;
          };
        }

        // Bind other methods to array representation
        return (...args: any[]) => {
          const array = rrbToArray(rrb);
          return (array as any)[prop](...args);
        };
      }

      // Default: return from base
      return base[prop as any];
    },

    set(_, prop, value) {
      // Handle numeric indices
      const index = Number(prop);
      if (!Number.isNaN(index) && index >= 0) {
        ensureModified();

        // Handle nothing symbol
        if (value === nothing) {
          // Convert to array, remove element, convert back
          const array = rrbToArray(rrb);
          array.splice(index, 1);
          rrb = arrayToRRB(array);
          return true;
        }

        // Unwrap drafts
        const valueState = getState(value);
        const actualValue = valueState ? latest(valueState) : value;

        // Fast path: index within bounds
        if (index < rrb.length) {
          rrb = rrbSet(rrb, index, actualValue);
        } else {
          // Extend array
          const array = rrbToArray(rrb);
          array[index] = actualValue;
          rrb = arrayToRRB(array);
        }

        return true;
      }

      // Handle length property
      if (prop === "length") {
        ensureModified();
        const newLength = Number(value);
        const array = rrbToArray(rrb);
        array.length = newLength;
        rrb = arrayToRRB(array);
        return true;
      }

      return true;
    },

    deleteProperty(_, prop) {
      const index = Number(prop);
      if (!Number.isNaN(index) && index >= 0 && index < rrb.length) {
        ensureModified();
        const array = rrbToArray(rrb);
        delete array[index];
        rrb = arrayToRRB(array);
      }
      return true;
    },

    has(_, prop) {
      const index = Number(prop);
      if (!Number.isNaN(index)) {
        return index >= 0 && index < rrb.length;
      }
      return prop in base;
    },

    ownKeys(_) {
      const keys: (string | symbol)[] = [];
      for (let i = 0; i < rrb.length; i++) {
        keys.push(String(i));
      }
      keys.push("length");
      return keys;
    },

    getOwnPropertyDescriptor(_, prop) {
      const index = Number(prop);
      if (!Number.isNaN(index) && index >= 0 && index < rrb.length) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: rrbGet(rrb, index),
        };
      }

      if (prop === "length") {
        return {
          configurable: false,
          enumerable: false,
          writable: true,
          value: rrb.length,
        };
      }

      return undefined;
    },
  };

  function ensureModified() {
    if (!modified) {
      modified = true;
      state.modified = true;
      if (parent) {
        markChanged(parent);
      }
    }
  }

  // Store RRB vector in state for finalization
  (state as any).rrb = rrb;
  (state as any).getRRB = () => rrb;

  return new Proxy([], handler);
}

/**
 * Finalize RRB array proxy - convert back to regular array
 */
export function finalizeRRBArray(state: DraftState): any[] {
  const rrb = (state as any).getRRB?.();
  if (!rrb) {
    return state.base;
  }

  return rrbToArray(rrb);
}
