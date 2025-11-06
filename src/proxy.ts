/**
 * Optimized proxy handler for draft objects
 * Performance improvements:
 * 1. Reduced Map lookups for child drafts
 * 2. Lazy proxy creation for array elements
 * 3. Fast path for primitive values
 * 4. Optimized property descriptor handling
 */

import { nothing } from "./nothing";
import {
  DRAFT_STATE,
  type DraftState,
  getState,
  isDraft,
  isDraftable,
  latest,
  markChanged,
  peek,
  shallowCopy,
} from "./utils";

// Store child drafts per parent state
const childDrafts = new WeakMap<DraftState, Map<string | symbol, any>>();

// Export for use in utils.ts
export { childDrafts };

// Cache wrapped array methods per state to avoid recreating them
const methodCache = new WeakMap<DraftState, Map<string, Function>>();

// Fast path checks
const ARRAY_METHODS = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]);

export function createProxy(base: any, parent: DraftState | null = null): any {
  // Fast path: return non-draftable values as-is
  if (!isDraftable(base)) {
    return base;
  }

  const isArray = Array.isArray(base);

  const state: DraftState = {
    base,
    copy: null,
    modified: false,
    parent,
    revoked: false,
    finalized: false,
  };

  const target = isArray ? [] : ({} as any);

  const handler: ProxyHandler<any> = {
    get(_, prop) {
      // Fast path: DRAFT_STATE symbol
      if (prop === DRAFT_STATE) return state;

      // Inline latest() for better performance
      const source = state.copy ?? state.base;
      const value = source[prop];

      // Fast path: primitives and methods
      if (typeof value !== "object" || value === null) {
        // Wrap array mutating methods with caching
        if (isArray && typeof value === "function" && ARRAY_METHODS.has(prop as string)) {
          // Optimized caching: avoid double Map lookup
          const methods = methodCache.get(state) ?? (() => {
            const m = new Map();
            methodCache.set(state, m);
            return m;
          })();

          const cached = methods.get(prop as string);
          if (cached) return cached;

          // Create optimized wrapper that avoids redundant operations
          const wrapped = function (this: any, ...args: any[]) {
            // Only mark changed if not already modified
            if (!state.modified) {
              markChanged(state);
            }
            // Apply directly on the copy
            return state.copy![prop].apply(state.copy, args);
          };
          methods.set(prop as string, wrapped);

          return wrapped;
        }
        return value;
      }

      // If it's already a draft, return it
      if (isDraft(value)) {
        return value;
      }

      // If accessing a nested draftable object, wrap it in a proxy
      if (isDraftable(value)) {
        // immer-inspired optimization: only create draft if value is from base
        // This avoids creating copies for values that were already replaced
        if (value === state.base[prop]) {
          // Optimized: avoid double Map lookup
          const children = childDrafts.get(state) ?? (() => {
            const c = new Map();
            childDrafts.set(state, c);
            return c;
          })();

          const cached = children.get(prop);
          if (cached) return cached;

          // Create new child draft
          const childDraft = createProxy(value, state);
          children.set(prop, childDraft);

          // prepareCopy - ensure parent has a copy before storing child draft
          if (!state.copy) {
            state.copy = shallowCopy(state.base);
          }
          state.copy[prop] = childDraft;

          return childDraft;
        }
        // Value was already replaced, return it directly
        return value;
      }

      return value;
    },

    set(_, prop, value) {
      // Inline latest() for better performance
      const source = state.copy ?? state.base;
      const current = source[prop];

      // Handle nothing symbol - delete the property/element
      if (value === nothing) {
        if (!(prop in source)) {
          return true;
        }

        markChanged(state);

        if (isArray) {
          state.copy![prop] = nothing;
        } else {
          delete state.copy![prop];
        }

        // Clear child draft
        const children = childDrafts.get(state);
        if (children) {
          children.delete(prop);
        }

        return true;
      }

      // Unwrap value if it's a draft
      const valueState = getState(value);
      const actualValue = valueState ? latest(valueState) : value;

      // Fast path: no change
      if (Object.is(current, actualValue)) {
        return true;
      }

      // Mark as modified and update copy
      markChanged(state);
      state.copy![prop] = actualValue;

      // Clear child draft for this property since it's being replaced
      const children = childDrafts.get(state);
      if (children) {
        children.delete(prop);
      }

      return true;
    },

    deleteProperty(_, prop) {
      markChanged(state);
      delete state.copy![prop];

      // Clear child draft
      const children = childDrafts.get(state);
      if (children) {
        children.delete(prop);
      }

      return true;
    },

    has(_, prop) {
      return prop in (state.copy ?? state.base);
    },

    ownKeys(_) {
      return Reflect.ownKeys(state.copy ?? state.base);
    },

    getOwnPropertyDescriptor(_, prop) {
      const source = state.copy ?? state.base;
      const desc = Reflect.getOwnPropertyDescriptor(source, prop);
      if (desc) {
        // Fast path: preserve array length descriptor
        if (isArray && prop === "length") {
          return desc;
        }
        return {
          ...desc,
          configurable: true,
          writable: true,
        };
      }
      return desc;
    },
  };

  const proxy = new Proxy(target, handler);

  return proxy;
}

export function revokeProxy(draft: any): void {
  const state = getState(draft);
  if (state) {
    state.revoked = true;
  }
}
