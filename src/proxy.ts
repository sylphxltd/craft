/**
 * Proxy handler for draft objects
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

// Store child drafts per parent state
const childDrafts = new WeakMap<DraftState, Map<string | symbol, any>>();

export function createProxy(base: any, parent: DraftState | null = null): any {
  // Return non-draftable values as-is
  if (!isDraftable(base)) {
    return base;
  }

  const state: DraftState = {
    base,
    copy: null,
    modified: false,
    parent,
    revoked: false,
  };

  const target = Array.isArray(base) ? [] : ({} as any);

  const handler: ProxyHandler<any> = {
    get(_, prop) {
      if (prop === DRAFT_STATE) return state;

      const source = latest(state);
      const value = source[prop];

      // If it's already a draft, return it
      if (isDraft(value)) {
        return value;
      }

      // If accessing a nested draftable object, wrap it in a proxy
      if (isDraftable(value)) {
        // Check if we already created a child draft for this property
        let children = childDrafts.get(state);
        if (!children) {
          children = new Map();
          childDrafts.set(state, children);
        }

        let childDraft = children.get(prop);
        if (!childDraft) {
          childDraft = createProxy(value, state);
          children.set(prop, childDraft);

          // Ensure we have a copy to store the child draft in
          if (!state.copy) {
            state.copy = shallowCopy(state.base);
          }
          // Store the child draft in the copy so it's available during finalize
          state.copy[prop] = childDraft;
        }

        return childDraft;
      }

      return value;
    },

    set(_, prop, value) {
      const source = latest(state);
      const current = source[prop];

      // Unwrap value if it's a draft
      const valueState = getState(value);
      const actualValue = valueState ? latest(valueState) : value;

      // No change
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

      // Clear child draft for this property
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
        // For arrays, preserve length property descriptor
        if (Array.isArray(source) && prop === "length") {
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
