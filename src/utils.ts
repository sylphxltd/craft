/**
 * Utility functions for Craft
 */

import { getConfig } from "./config";
import { finalizeMap, finalizeSet, getMapState, getSetState } from "./map-set";
import { nothing } from "./nothing";

const DRAFT_STATE = Symbol("craft-draft-state");
const PROXY_TARGET = Symbol("craft-proxy-target");

export interface DraftState {
  base: any;
  copy: any | null;
  modified: boolean;
  parent: DraftState | null;
  revoked: boolean;
  finalized: boolean; // immer-inspired: prevent duplicate finalization
  drafts?: Map<string | symbol, any>; // Store child drafts directly on state
}

export function isDraft(value: any): boolean {
  return value?.[DRAFT_STATE] !== undefined;
}

export function isDraftable(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return true;
  if (value instanceof Map || value instanceof Set) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function getState(draft: any): DraftState | undefined {
  return draft[DRAFT_STATE];
}

export function latest(state: DraftState): any {
  return state.copy ?? state.base;
}

// Peek at a property without creating a draft (immer-inspired optimization)
export function peek(target: any, prop: string | symbol): any {
  const state = target[DRAFT_STATE];
  const source = state ? latest(state) : target;
  return source[prop];
}

/**
 * Get the original value of a draft
 * Useful for comparisons inside a producer function
 *
 * @param value - A draft or regular value
 * @returns The original base value, or the value itself if not a draft
 *
 * @example
 * ```ts
 * craft(state, (draft) => {
 *   draft.count = 10;
 *   console.log(original(draft)?.count); // 0 (original value)
 *   console.log(draft.count); // 10 (current value)
 * });
 * ```
 */
export function original<T>(value: T): T | undefined {
  if (!isDraft(value)) return undefined;
  const state = getState(value);
  return state?.base;
}

/**
 * Get a frozen immutable snapshot of the current draft state
 * Useful for accessing the draft state outside the producer
 *
 * @param value - A draft value
 * @returns An immutable snapshot of the current state
 *
 * @example
 * ```ts
 * craft(state, (draft) => {
 *   draft.items.push(4);
 *   const snapshot = current(draft);
 *   console.log(snapshot.items); // [1, 2, 3, 4]
 *   // snapshot is immutable and can be safely shared
 * });
 * ```
 */
export function current<T>(value: T): T {
  if (!isDraft(value)) {
    // Check if it's a Map/Set proxy
    const mapState = getMapState(value);
    if (mapState) {
      return (mapState.copy ?? mapState.base) as T;
    }
    const setState = getSetState(value);
    if (setState) {
      return (setState.copy ?? setState.base) as T;
    }
    return value;
  }

  const state = getState(value);
  if (!state) return value;

  const currentState = latest(state);

  // Create a deep copy with all nested drafts finalized
  const result = shallowCopy(currentState);

  // Recursively finalize nested values
  each(result, (key, val) => {
    // Handle Map/Set proxies
    const mapState = getMapState(val);
    if (mapState) {
      result[key] = mapState.copy ?? mapState.base;
      return;
    }
    const setState = getSetState(val);
    if (setState) {
      result[key] = setState.copy ?? setState.base;
      return;
    }

    if (isDraft(val)) {
      result[key] = current(val);
    }
  });

  // Return frozen snapshot
  return freeze(result, true);
}

export function shallowCopy<T>(base: T): T {
  if (Array.isArray(base)) {
    // Direct slice() is faster than .call() indirection
    return base.slice() as any;
  }
  if (base && typeof base === "object") {
    const config = getConfig();
    if (config.useStrictShallowCopy) {
      // Copy all properties including non-enumerable
      const copy = Object.create(Object.getPrototypeOf(base));
      const props = Object.getOwnPropertyDescriptors(base);
      Object.defineProperties(copy, props);
      return copy;
    }
    // Use spread operator for better performance
    return { ...base } as T;
  }
  return base;
}

export function markChanged(state: DraftState): void {
  if (!state.modified) {
    state.modified = true;
    if (!state.copy) {
      state.copy = shallowCopy(state.base);
    }
    if (state.parent) {
      markChanged(state.parent);
    }
  }
}

export function freeze<T>(obj: T, deep = false): T {
  if (!obj || typeof obj !== "object") return obj;
  if (Object.isFrozen(obj)) return obj;

  Object.freeze(obj);

  if (deep) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        freeze(obj[key], true);
      }
    }
  }

  return obj;
}

export function finalize(state: DraftState, autoFreeze?: boolean): any {
  // immer-inspired: prevent duplicate finalization
  if (state.finalized) {
    return state.copy ?? state.base;
  }

  // Use config if autoFreeze not explicitly provided
  const shouldFreeze = autoFreeze ?? getConfig().autoFreeze;

  if (!state.modified) {
    // immer-inspired: check if already frozen
    const value = state.base;
    if (Object.isFrozen(value)) {
      return value;
    }
    // Freeze and return base
    if (shouldFreeze) {
      freeze(value, false);
    }
    return value;
  }

  // Mark as finalized before processing
  state.finalized = true;

  const result = state.copy!;
  const isArray = Array.isArray(result);

  // Optimized path for arrays
  if (isArray) {
    // Single-pass optimization: scan for nothing and drafts simultaneously
    let hasNothing = false;
    let hasDrafts = false;

    for (let i = 0; i < result.length; i++) {
      const value = result[i];
      if (value === nothing) {
        hasNothing = true;
        break; // If we find nothing, we need to filter
      }
      if (isDraft(value)) {
        hasDrafts = true;
      }
    }

    // Fast path: no nothing, no drafts - just freeze
    if (!hasNothing && !hasDrafts) {
      return shouldFreeze ? freeze(result, false) : result;
    }

    // If we have nothing symbols, filter while finalizing drafts
    if (hasNothing) {
      const filtered: any[] = [];
      for (let i = 0; i < result.length; i++) {
        const value = result[i];
        if (value === nothing) continue;

        // Check for Map/Set proxies first
        const mapState = getMapState(value);
        if (mapState) {
          filtered.push(finalizeMap(mapState));
          continue;
        }
        const setState = getSetState(value);
        if (setState) {
          filtered.push(finalizeSet(setState));
          continue;
        }

        if (isDraft(value)) {
          const childState = getState(value);
          filtered.push(childState ? finalize(childState, shouldFreeze) : value);
        } else {
          filtered.push(value);
        }
      }
      return shouldFreeze ? freeze(filtered, false) : filtered;
    }

    // Only drafts - finalize in place
    for (let i = 0; i < result.length; i++) {
      const value = result[i];

      // Check for Map/Set proxies first
      const mapState = getMapState(value);
      if (mapState) {
        result[i] = finalizeMap(mapState);
        continue;
      }
      const setState = getSetState(value);
      if (setState) {
        result[i] = finalizeSet(setState);
        continue;
      }

      if (isDraft(value)) {
        const childState = getState(value);
        if (childState) {
          result[i] = finalize(childState, shouldFreeze);
        }
      }
    }

    return shouldFreeze ? freeze(result, false) : result;
  }

  // Finalize object properties recursively
  // Single-pass: combine scan and finalize to avoid double iteration
  const keys = Object.keys(result);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const value = result[key];

    // Check for Map/Set proxies first
    const mapState = getMapState(value);
    if (mapState) {
      result[key] = finalizeMap(mapState);
      continue;
    }
    const setState = getSetState(value);
    if (setState) {
      result[key] = finalizeSet(setState);
      continue;
    }

    if (isDraft(value)) {
      const childState = getState(value);
      if (childState) {
        result[key] = finalize(childState, shouldFreeze);
      }
    }
  }

  if (shouldFreeze) {
    freeze(result, false);
  }

  return result;
}

function each(obj: any, callback: (key: string | number, value: any) => void): void {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      callback(i, obj[i]);
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        callback(key, obj[key]);
      }
    }
  }
}

export { DRAFT_STATE, PROXY_TARGET };
