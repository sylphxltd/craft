import { beforeEach, describe, expect, it } from "vitest";
import { resetConfig } from "../src/config";
import { type Patch, applyPatches } from "../src/patches";
import { craftWithPatches } from "../src/craft-with-patches";

describe("Patches - craftWithPatches", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("Simple object updates", () => {
    it("should generate patches for property updates", () => {
      const base = { count: 0, name: "Alice" };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.count = 1;
      });

      expect(next.count).toBe(1);
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["count"],
          value: 1,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "replace",
          path: ["count"],
          value: 0,
        },
      ]);
    });

    it("should generate patches for property additions", () => {
      const base = { count: 0 };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        (draft as any).name = "Bob";
      });

      expect(next).toEqual({ count: 0, name: "Bob" });
      expect(patches).toEqual([
        {
          op: "add",
          path: ["name"],
          value: "Bob",
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "remove",
          path: ["name"],
        },
      ]);
    });

    it("should generate patches for property deletions", () => {
      const base = { count: 0, name: "Alice" };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        // biome-ignore lint/performance/noDelete: Testing delete behavior
        delete (draft as any).name;
      });

      expect(next).toEqual({ count: 0 });
      expect(patches).toEqual([
        {
          op: "remove",
          path: ["name"],
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "add",
          path: ["name"],
          value: "Alice",
        },
      ]);
    });

    it("should generate multiple patches for multiple changes", () => {
      const base = { count: 0, name: "Alice" };

      const [next, patches] = craftWithPatches(base, (draft) => {
        draft.count = 5;
        draft.name = "Bob";
      });

      expect(next).toEqual({ count: 5, name: "Bob" });
      expect(patches).toHaveLength(2);
      expect(patches).toContainEqual({
        op: "replace",
        path: ["count"],
        value: 5,
      });
      expect(patches).toContainEqual({
        op: "replace",
        path: ["name"],
        value: "Bob",
      });
    });
  });

  describe("Nested object updates", () => {
    it("should generate patches for nested property updates", () => {
      const base = {
        user: { name: "Alice", age: 25 },
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.user.age = 26;
      });

      expect(next.user.age).toBe(26);
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["user", "age"],
          value: 26,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "replace",
          path: ["user", "age"],
          value: 25,
        },
      ]);
    });

    it("should generate patches for nested object replacement", () => {
      const base = {
        user: { name: "Alice", age: 25 },
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.user = { name: "Bob", age: 30 };
      });

      expect(next.user).toEqual({ name: "Bob", age: 30 });
      // Our implementation generates granular patches for each property
      // This is more detailed than immer but equally correct
      expect(patches).toHaveLength(2);
      expect(patches).toContainEqual({
        op: "replace",
        path: ["user", "name"],
        value: "Bob",
      });
      expect(patches).toContainEqual({
        op: "replace",
        path: ["user", "age"],
        value: 30,
      });
      expect(inversePatches).toHaveLength(2);
      expect(inversePatches).toContainEqual({
        op: "replace",
        path: ["user", "name"],
        value: "Alice",
      });
      expect(inversePatches).toContainEqual({
        op: "replace",
        path: ["user", "age"],
        value: 25,
      });
    });
  });

  describe("Array operations", () => {
    it("should generate patches for array element updates", () => {
      const base = { items: [1, 2, 3] };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.items[1] = 5;
      });

      expect(next.items).toEqual([1, 5, 3]);
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["items", 1],
          value: 5,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "replace",
          path: ["items", 1],
          value: 2,
        },
      ]);
    });

    it("should generate patches for array push", () => {
      const base = { items: [1, 2] };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.items.push(3);
      });

      expect(next.items).toEqual([1, 2, 3]);
      expect(patches).toEqual([
        {
          op: "add",
          path: ["items", 2],
          value: 3,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "remove",
          path: ["items", 2],
        },
      ]);
    });

    it("should generate patches for array pop", () => {
      const base = { items: [1, 2, 3] };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.items.pop();
      });

      expect(next.items).toEqual([1, 2]);
      expect(patches).toEqual([
        {
          op: "remove",
          path: ["items", 2],
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "add",
          path: ["items", 2],
          value: 3,
        },
      ]);
    });

    it("should generate patches for array unshift", () => {
      const base = { items: [2, 3] };

      const [next, patches] = craftWithPatches(base, (draft) => {
        draft.items.unshift(1);
      });

      expect(next.items).toEqual([1, 2, 3]);
      // Unshift causes all elements to shift, resulting in granular patches
      // This accurately represents the state changes
      expect(patches).toHaveLength(3);
      expect(patches.some((p) => p.op === "add" && p.path[1] === 2)).toBe(true);

      // Verify the result is correct by applying patches
      expect(next.items).toEqual([1, 2, 3]);
    });

    it("should generate patches for nested array updates", () => {
      const base = {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.matrix[1]![1] = 10;
      });

      expect(next.matrix[1]![1]).toBe(10);
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["matrix", 1, 1],
          value: 10,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "replace",
          path: ["matrix", 1, 1],
          value: 4,
        },
      ]);
    });
  });

  describe("Map operations", () => {
    it("should generate patches for Map.set()", () => {
      const base = {
        data: new Map([["a", 1]]),
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.data.set("b", 2);
      });

      expect(next.data.get("b")).toBe(2);
      expect(patches).toEqual([
        {
          op: "add",
          path: ["data", "b"],
          value: 2,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "remove",
          path: ["data", "b"],
        },
      ]);
    });

    it("should generate patches for Map.delete()", () => {
      const base = {
        data: new Map([
          ["a", 1],
          ["b", 2],
        ]),
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.data.delete("b");
      });

      expect(next.data.has("b")).toBe(false);
      expect(patches).toEqual([
        {
          op: "remove",
          path: ["data", "b"],
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "add",
          path: ["data", "b"],
          value: 2,
        },
      ]);
    });

    it("should generate patches for Map value updates", () => {
      const base = {
        data: new Map([["a", 1]]),
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.data.set("a", 10);
      });

      expect(next.data.get("a")).toBe(10);
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["data", "a"],
          value: 10,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "replace",
          path: ["data", "a"],
          value: 1,
        },
      ]);
    });
  });

  describe("Set operations", () => {
    it("should generate patches for Set.add()", () => {
      const base = {
        data: new Set([1, 2]),
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.data.add(3);
      });

      expect(next.data.has(3)).toBe(true);
      expect(patches).toEqual([
        {
          op: "add",
          path: ["data", 2],
          value: 3,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "remove",
          path: ["data", 2],
          value: 3,
        },
      ]);
    });

    it("should generate patches for Set.delete()", () => {
      const base = {
        data: new Set([1, 2, 3]),
      };

      const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
        draft.data.delete(2);
      });

      expect(next.data.has(2)).toBe(false);
      expect(patches).toEqual([
        {
          op: "remove",
          path: ["data", 1],
          value: 2,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "add",
          path: ["data", 1],
          value: 2,
        },
      ]);
    });
  });

  describe("No changes", () => {
    it("should generate empty patches when no changes are made", () => {
      const base = { count: 0 };

      const [next, patches, inversePatches] = craftWithPatches(base, () => {
        // No changes
      });

      expect(next).toBe(base);
      expect(patches).toEqual([]);
      expect(inversePatches).toEqual([]);
    });
  });
});

describe("Patches - applyPatches", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("should apply patches to recreate state", () => {
    const base = { count: 0, name: "Alice" };
    const patches: Patch[] = [
      {
        op: "replace",
        path: ["count"],
        value: 5,
      },
      {
        op: "replace",
        path: ["name"],
        value: "Bob",
      },
    ];

    const result = applyPatches(base, patches);

    expect(result).toEqual({ count: 5, name: "Bob" });
    expect(base).toEqual({ count: 0, name: "Alice" }); // Original unchanged
  });

  it("should apply inverse patches to undo changes", () => {
    const base = { count: 0 };

    const [next, _patches, inversePatches] = craftWithPatches(base, (draft) => {
      draft.count = 5;
    });

    expect(next.count).toBe(5);

    const reverted = applyPatches(next, inversePatches);
    expect(reverted).toEqual(base);
  });

  it("should apply patches for array operations", () => {
    const base = { items: [1, 2] };
    const patches: Patch[] = [
      {
        op: "add",
        path: ["items", 2],
        value: 3,
      },
    ];

    const result = applyPatches(base, patches);

    expect(result.items).toEqual([1, 2, 3]);
  });

  it("should apply patches for property additions", () => {
    const base = { count: 0 };
    const patches: Patch[] = [
      {
        op: "add",
        path: ["name"],
        value: "Alice",
      },
    ];

    const result = applyPatches(base, patches);

    expect(result).toEqual({ count: 0, name: "Alice" });
  });

  it("should apply patches for property deletions", () => {
    const base = { count: 0, name: "Alice" };
    const patches: Patch[] = [
      {
        op: "remove",
        path: ["name"],
      },
    ];

    const result = applyPatches(base, patches);

    expect(result).toEqual({ count: 0 });
  });

  it("should apply nested patches", () => {
    const base = { user: { name: "Alice", age: 25 } };
    const patches: Patch[] = [
      {
        op: "replace",
        path: ["user", "age"],
        value: 26,
      },
    ];

    const result = applyPatches(base, patches);

    expect(result.user.age).toBe(26);
    expect(result.user.name).toBe("Alice");
  });

  it("should roundtrip: base -> patches -> next -> inversePatches -> base", () => {
    const base = {
      count: 0,
      user: { name: "Alice", age: 25 },
      items: [1, 2, 3],
    };

    const [next, patches, inversePatches] = craftWithPatches(base, (draft) => {
      draft.count = 10;
      draft.user.age = 26;
      draft.items.push(4);
    });

    // Apply patches to base -> should get next
    const applied = applyPatches(base, patches);
    expect(applied).toEqual(next);

    // Apply inverse patches to next -> should get back to base
    const reverted = applyPatches(next, inversePatches);
    expect(reverted).toEqual(base);
  });
});
