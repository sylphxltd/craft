/**
 * JSON Patches support (RFC 6902)
 * Track and generate patches for state mutations
 */

export type PatchOperation = "add" | "remove" | "replace";

export interface Patch {
  op: PatchOperation;
  path: (string | number)[];
  value?: any;
}

export interface PatchListener {
  patches: Patch[];
  inversePatches: Patch[];
}

/**
 * Create a new patch listener for tracking changes
 */
export function createPatchListener(): PatchListener {
  return {
    patches: [],
    inversePatches: [],
  };
}

/**
 * Generate patches by comparing base and next states
 * This is called during finalization to produce the patch list
 */
export function generatePatches(
  base: any,
  next: any,
  patches: Patch[],
  inversePatches: Patch[],
  basePath: (string | number)[] = [],
): void {
  if (base === next) return;

  const baseType = getType(base);
  const nextType = getType(next);

  // Type changed - replace
  if (baseType !== nextType) {
    patches.push({
      op: "replace",
      path: [...basePath],
      value: next,
    });
    inversePatches.unshift({
      op: "replace",
      path: [...basePath],
      value: base,
    });
    return;
  }

  switch (nextType) {
    case "array":
      generateArrayPatches(base, next, patches, inversePatches, basePath);
      break;
    case "object":
      generateObjectPatches(base, next, patches, inversePatches, basePath);
      break;
    case "map":
      generateMapPatches(base, next, patches, inversePatches, basePath);
      break;
    case "set":
      generateSetPatches(base, next, patches, inversePatches, basePath);
      break;
    default:
      // Primitive changed
      if (base !== next) {
        patches.push({
          op: "replace",
          path: [...basePath],
          value: next,
        });
        inversePatches.unshift({
          op: "replace",
          path: [...basePath],
          value: base,
        });
      }
  }
}

function generateArrayPatches(
  base: any[],
  next: any[],
  patches: Patch[],
  inversePatches: Patch[],
  basePath: (string | number)[],
): void {
  // Handle length changes
  if (base.length > next.length) {
    // Elements removed
    for (let i = next.length; i < base.length; i++) {
      patches.push({
        op: "remove",
        path: [...basePath, i],
      });
      inversePatches.unshift({
        op: "add",
        path: [...basePath, i],
        value: base[i],
      });
    }
  } else if (next.length > base.length) {
    // Elements added
    for (let i = base.length; i < next.length; i++) {
      patches.push({
        op: "add",
        path: [...basePath, i],
        value: next[i],
      });
      inversePatches.unshift({
        op: "remove",
        path: [...basePath, i],
      });
    }
  }

  // Compare existing elements
  const minLength = Math.min(base.length, next.length);
  for (let i = 0; i < minLength; i++) {
    generatePatches(base[i], next[i], patches, inversePatches, [...basePath, i]);
  }
}

function generateObjectPatches(
  base: any,
  next: any,
  patches: Patch[],
  inversePatches: Patch[],
  basePath: (string | number)[],
): void {
  const baseKeys = Object.keys(base);
  const nextKeys = Object.keys(next);

  // Check for removed keys
  for (const key of baseKeys) {
    if (!(key in next)) {
      patches.push({
        op: "remove",
        path: [...basePath, key],
      });
      inversePatches.unshift({
        op: "add",
        path: [...basePath, key],
        value: base[key],
      });
    }
  }

  // Check for added and modified keys
  for (const key of nextKeys) {
    if (!(key in base)) {
      // Added
      patches.push({
        op: "add",
        path: [...basePath, key],
        value: next[key],
      });
      inversePatches.unshift({
        op: "remove",
        path: [...basePath, key],
      });
    } else if (base[key] !== next[key]) {
      // Modified
      generatePatches(base[key], next[key], patches, inversePatches, [...basePath, key]);
    }
  }
}

function generateMapPatches(
  base: Map<any, any>,
  next: Map<any, any>,
  patches: Patch[],
  inversePatches: Patch[],
  basePath: (string | number)[],
): void {
  // Check for removed keys
  for (const [key, value] of base) {
    if (!next.has(key)) {
      patches.push({
        op: "remove",
        path: [...basePath, key],
      });
      inversePatches.unshift({
        op: "add",
        path: [...basePath, key],
        value,
      });
    }
  }

  // Check for added and modified keys
  for (const [key, value] of next) {
    if (!base.has(key)) {
      // Added
      patches.push({
        op: "add",
        path: [...basePath, key],
        value,
      });
      inversePatches.unshift({
        op: "remove",
        path: [...basePath, key],
      });
    } else if (base.get(key) !== value) {
      // Modified
      generatePatches(base.get(key), value, patches, inversePatches, [...basePath, key]);
    }
  }
}

function generateSetPatches(
  base: Set<any>,
  next: Set<any>,
  patches: Patch[],
  inversePatches: Patch[],
  basePath: (string | number)[],
): void {
  let index = 0;

  // Check for removed values
  for (const value of base) {
    if (!next.has(value)) {
      patches.push({
        op: "remove",
        path: [...basePath, index],
        value,
      });
      inversePatches.unshift({
        op: "add",
        path: [...basePath, index],
        value,
      });
    }
    index++;
  }

  // Check for added values
  index = 0;
  for (const value of next) {
    if (!base.has(value)) {
      patches.push({
        op: "add",
        path: [...basePath, index],
        value,
      });
      inversePatches.unshift({
        op: "remove",
        path: [...basePath, index],
        value,
      });
    }
    index++;
  }
}

function getType(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Map) return "map";
  if (value instanceof Set) return "set";
  if (typeof value === "object") return "object";
  return typeof value;
}

/**
 * Apply patches to a base state
 */
export function applyPatches<T>(base: T, patches: Patch[]): T {
  let result = base;

  for (const patch of patches) {
    result = applyPatch(result, patch);
  }

  return result;
}

function applyPatch<T>(base: T, patch: Patch): T {
  if (patch.path.length === 0) {
    // Root replacement
    if (patch.op === "replace") {
      return patch.value;
    }
    throw new Error(`Cannot ${patch.op} at root path`);
  }

  return applyPatchAtPath(base, patch.path, patch) as T;
}

function applyPatchAtPath(obj: any, path: (string | number)[], patch: Patch): any {
  if (path.length === 1) {
    const key = path[0]!;
    const copy = shallowClone(obj);

    switch (patch.op) {
      case "add":
      case "replace":
        if (Array.isArray(copy)) {
          copy[key as number] = patch.value;
        } else if (copy instanceof Map) {
          copy.set(key, patch.value);
        } else if (copy instanceof Set) {
          copy.add(patch.value);
        } else {
          copy[key] = patch.value;
        }
        break;
      case "remove":
        if (Array.isArray(copy)) {
          copy.splice(key as number, 1);
        } else if (copy instanceof Map) {
          copy.delete(key);
        } else if (copy instanceof Set) {
          copy.delete(patch.value);
        } else {
          delete copy[key];
        }
        break;
    }

    return copy;
  }

  // Recurse deeper
  const key = path[0]!;
  const copy = shallowClone(obj);
  const nested =
    Array.isArray(obj) || obj instanceof Map
      ? obj instanceof Map
        ? obj.get(key)
        : obj[key as number]
      : obj[key];

  const updated = applyPatchAtPath(nested, path.slice(1), patch);

  if (Array.isArray(copy)) {
    copy[key as number] = updated;
  } else if (copy instanceof Map) {
    copy.set(key, updated);
  } else {
    copy[key] = updated;
  }

  return copy;
}

function shallowClone(obj: any): any {
  if (Array.isArray(obj)) return obj.slice();
  if (obj instanceof Map) return new Map(obj);
  if (obj instanceof Set) return new Set(obj);
  if (obj && typeof obj === "object") return { ...obj };
  return obj;
}
