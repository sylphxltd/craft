/**
 * Map and Set proxy handlers
 * Full immer-compatible Map/Set mutation tracking
 */

import { DRAFT_STATE, type DraftState, markChanged } from "./utils";

const DRAFT_MAP_STATE = Symbol("craft-draft-map-state");
const DRAFT_SET_STATE = Symbol("craft-draft-set-state");

interface MapState {
  base: Map<any, any>;
  copy: Map<any, any> | null;
  modified: boolean;
  parent: DraftState | null;
  revoked: boolean;
  finalized: boolean;
}

interface SetState {
  base: Set<any>;
  copy: Set<any> | null;
  modified: boolean;
  parent: DraftState | null;
  revoked: boolean;
  finalized: boolean;
}

export function createMapProxy(base: Map<any, any>, parent: DraftState | null): Map<any, any> {
  const state: MapState = {
    base,
    copy: null,
    modified: false,
    parent,
    revoked: false,
    finalized: false,
  };

  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop === DRAFT_MAP_STATE) return state;
      if (prop === DRAFT_STATE) return parent;

      const value = target[prop as keyof Map<any, any>];

      if (typeof value === "function") {
        // Intercept Map methods
        switch (prop) {
          case "set":
            return (key: any, val: any) => {
              if (!state.modified) {
                prepareCopy(state);
              }
              return state.copy!.set(key, val);
            };
          case "delete":
            return (key: any) => {
              if (!state.modified) {
                prepareCopy(state);
              }
              return state.copy!.delete(key);
            };
          case "clear":
            return () => {
              if (!state.modified) {
                prepareCopy(state);
              }
              return state.copy!.clear();
            };
          case "get":
            return (key: any) => {
              const source = state.copy ?? state.base;
              return source.get(key);
            };
          case "has":
            return (key: any) => {
              const source = state.copy ?? state.base;
              return source.has(key);
            };
          case "forEach":
            return (callback: any, thisArg?: any) => {
              const source = state.copy ?? state.base;
              return source.forEach(callback, thisArg);
            };
          case "keys":
            return () => {
              const source = state.copy ?? state.base;
              return source.keys();
            };
          case "values":
            return () => {
              const source = state.copy ?? state.base;
              return source.values();
            };
          case "entries":
            return () => {
              const source = state.copy ?? state.base;
              return source.entries();
            };
          case Symbol.iterator:
            return () => {
              const source = state.copy ?? state.base;
              return source[Symbol.iterator]();
            };
          default:
            return value.bind(target);
        }
      }

      return value;
    },
    has(target, prop) {
      return prop in target;
    },
  });

  return proxy as Map<any, any>;
}

export function createSetProxy(base: Set<any>, parent: DraftState | null): Set<any> {
  const state: SetState = {
    base,
    copy: null,
    modified: false,
    parent,
    revoked: false,
    finalized: false,
  };

  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop === DRAFT_SET_STATE) return state;
      if (prop === DRAFT_STATE) return parent;

      const value = target[prop as keyof Set<any>];

      if (typeof value === "function") {
        // Intercept Set methods
        switch (prop) {
          case "add":
            return (val: any) => {
              if (!state.modified) {
                prepareCopySet(state);
              }
              return state.copy!.add(val);
            };
          case "delete":
            return (val: any) => {
              if (!state.modified) {
                prepareCopySet(state);
              }
              return state.copy!.delete(val);
            };
          case "clear":
            return () => {
              if (!state.modified) {
                prepareCopySet(state);
              }
              return state.copy!.clear();
            };
          case "has":
            return (val: any) => {
              const source = state.copy ?? state.base;
              return source.has(val);
            };
          case "forEach":
            return (callback: any, thisArg?: any) => {
              const source = state.copy ?? state.base;
              return source.forEach(callback, thisArg);
            };
          case "keys":
            return () => {
              const source = state.copy ?? state.base;
              return source.keys();
            };
          case "values":
            return () => {
              const source = state.copy ?? state.base;
              return source.values();
            };
          case "entries":
            return () => {
              const source = state.copy ?? state.base;
              return source.entries();
            };
          case Symbol.iterator:
            return () => {
              const source = state.copy ?? state.base;
              return source[Symbol.iterator]();
            };
          default:
            return value.bind(target);
        }
      }

      return value;
    },
    has(target, prop) {
      return prop in target;
    },
  });

  return proxy as Set<any>;
}

function prepareCopy(state: MapState) {
  if (!state.copy) {
    state.modified = true;
    state.copy = new Map(state.base);
    if (state.parent) {
      markChanged(state.parent);
    }
  }
}

function prepareCopySet(state: SetState) {
  if (!state.copy) {
    state.modified = true;
    state.copy = new Set(state.base);
    if (state.parent) {
      markChanged(state.parent);
    }
  }
}

export function finalizeMap(state: MapState): Map<any, any> {
  if (state.finalized) {
    return state.copy ?? state.base;
  }
  state.finalized = true;
  return state.copy ?? state.base;
}

export function finalizeSet(state: SetState): Set<any> {
  if (state.finalized) {
    return state.copy ?? state.base;
  }
  state.finalized = true;
  return state.copy ?? state.base;
}

export function isMap(value: any): value is Map<any, any> {
  return value instanceof Map;
}

export function isSet(value: any): value is Set<any> {
  return value instanceof Set;
}

export function getMapState(map: any): MapState | undefined {
  return map[DRAFT_MAP_STATE];
}

export function getSetState(set: any): SetState | undefined {
  return set[DRAFT_SET_STATE];
}

export { DRAFT_MAP_STATE, DRAFT_SET_STATE };
export type { MapState, SetState };
