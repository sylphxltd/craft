/**
 * Optimized proxy handler for draft objects
 * Performance improvements:
 * 1. Reduced Map lookups for child drafts
 * 2. Lazy proxy creation for array elements
 * 3. Fast path for primitive values
 * 4. Optimized property descriptor handling
 */

import {
  DRAFT_STATE,
  type DraftState,
  getState,
  isDraft,
  isDraftable,
  latest,
  markChanged,
  shallowCopy,
} from "./utils";
import { nothing } from "./nothing";

// Store child drafts per parent state
const childDrafts = new WeakMap<DraftState, Map<string | symbol, any>>();

// Export for use in utils.ts
export { childDrafts };

// Cache wrapped array methods per state to avoid recreating them
const methodCache = new WeakMap<DraftState, Map<string, Function>>();

// Fast path checks
const ARRAY_METHODS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
]);

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
  };

  const target = isArray ? [] : ({} as any);

  const handler: ProxyHandler<any> = {
    get(_, prop) {
      // Fast path: DRAFT_STATE symbol
      if (prop === DRAFT_STATE) return state;

      const source = latest(state);
      const value = source[prop];

      // Fast path: primitives and methods
      if (typeof value !== "object" || value === null) {
        // Wrap array mutating methods with caching
        if (isArray && typeof value === "function" && ARRAY_METHODS.has(prop as string)) {
          // Check cache first
          let methods = methodCache.get(state);
          if (!methods) {
            methods = new Map();
            methodCache.set(state, methods);
          }

          let wrapped = methods.get(prop as string);
          if (!wrapped) {
            // Create optimized wrapper that avoids redundant operations
            wrapped = function (this: any, ...args: any[]) {
              // Only mark changed if not already modified
              if (!state.modified) {
                markChanged(state);
              }
              // Apply directly on the copy
              return state.copy![prop].apply(state.copy, args);
            };
            methods.set(prop as string, wrapped);
          }

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
        // Lazy create child drafts map
        let children = childDrafts.get(state);
        if (!children) {
          children = new Map();
          childDrafts.set(state, children);
        }

        // Check cache first
        let childDraft = children.get(prop);
        if (!childDraft) {
          childDraft = createProxy(value, state);
          children.set(prop, childDraft);

          // Store child draft in parent's copy (but don't mark as modified yet)
          if (!state.copy) {
            state.copy = shallowCopy(state.base);
          }
          state.copy[prop] = childDraft;
        }

        return childDraft;
      }

      return value;
    },

    set(_, prop, value) {
      const source = latest(state);
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
      return prop in latest(state);
    },

    ownKeys(_) {
      return Reflect.ownKeys(latest(state));
    },

    getOwnPropertyDescriptor(_, prop) {
      const source = latest(state);
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
