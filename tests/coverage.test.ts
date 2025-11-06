import { beforeEach, describe, expect, it } from "vitest";
import { resetConfig } from "../src/config";
import { craft } from "../src/craft";
import { createDraft, finishDraft } from "../src/manual";
import { nothing } from "../src/nothing";
import { applyPatches, createPatchListener } from "../src/patches";
import { produceWithPatches } from "../src/produce-with-patches";
import { current, freeze, peek } from "../src/utils";

describe("Coverage - Edge Cases", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("Map/Set edge cases", () => {
    it("should handle Map.size property access", () => {
      const base = {
        data: new Map([
          ["a", 1],
          ["b", 2],
        ]),
      };

      craft(base, (draft) => {
        expect(draft.data.size).toBe(2);
        expect("size" in draft.data).toBe(true);
      });
    });

    it("should handle Set.size property access", () => {
      const base = {
        data: new Set([1, 2, 3]),
      };

      craft(base, (draft) => {
        expect(draft.data.size).toBe(3);
        expect("size" in draft.data).toBe(true);
      });
    });

    it("should handle Map property checks with 'in' operator", () => {
      const base = {
        data: new Map([["key", "value"]]),
      };

      craft(base, (draft) => {
        expect("set" in draft.data).toBe(true);
        expect("get" in draft.data).toBe(true);
        expect("has" in draft.data).toBe(true);
      });
    });

    it("should handle Set property checks with 'in' operator", () => {
      const base = {
        data: new Set([1, 2, 3]),
      };

      craft(base, (draft) => {
        expect("add" in draft.data).toBe(true);
        expect("has" in draft.data).toBe(true);
        expect("delete" in draft.data).toBe(true);
      });
    });

    it("should handle Map.clear() with parent notification", () => {
      const base = {
        data: new Map([["a", 1]]),
      };

      const next = craft(base, (draft) => {
        draft.data.clear();
      });

      expect(next.data.size).toBe(0);
      expect(base.data.size).toBe(1);
    });

    it("should handle Set.clear() with parent notification", () => {
      const base = {
        data: new Set([1, 2, 3]),
      };

      const next = craft(base, (draft) => {
        draft.data.clear();
      });

      expect(next.data.size).toBe(0);
      expect(base.data.size).toBe(3);
    });
  });

  describe("Patches edge cases", () => {
    it("should expose createPatchListener", () => {
      const listener = createPatchListener();
      expect(listener.patches).toEqual([]);
      expect(listener.inversePatches).toEqual([]);
    });

    it("should handle type changes in patches", () => {
      const base = {
        value: "string",
      };

      const [next, patches, inversePatches] = produceWithPatches(base, (draft) => {
        (draft as any).value = 123; // Change from string to number
      });

      expect(next.value).toBe(123);
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["value"],
          value: 123,
        },
      ]);
      expect(inversePatches).toEqual([
        {
          op: "replace",
          path: ["value"],
          value: "string",
        },
      ]);
    });

    it("should handle null to object type change", () => {
      const base = {
        value: null,
      };

      const [next, patches] = produceWithPatches(base, (draft) => {
        (draft as any).value = { nested: "object" };
      });

      expect(next.value).toEqual({ nested: "object" });
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["value"],
          value: { nested: "object" },
        },
      ]);
    });

    it("should handle array to object type change", () => {
      const base = {
        value: [1, 2, 3],
      };

      const [next, patches] = produceWithPatches(base, (draft) => {
        (draft as any).value = { count: 3 };
      });

      expect(next.value).toEqual({ count: 3 });
      expect(patches).toEqual([
        {
          op: "replace",
          path: ["value"],
          value: { count: 3 },
        },
      ]);
    });

    it("should throw error when applying root-level add/remove", () => {
      expect(() => {
        applyPatches({ count: 0 }, [{ op: "add", path: [], value: 1 }]);
      }).toThrow();

      expect(() => {
        applyPatches({ count: 0 }, [{ op: "remove", path: [] }]);
      }).toThrow();
    });

    it("should handle applying patches to Maps", () => {
      const base = {
        data: new Map([["a", 1]]),
      };

      const result = applyPatches(base, [
        {
          op: "add",
          path: ["data", "b"],
          value: 2,
        },
      ]);

      expect(result.data.get("b")).toBe(2);
    });

    it("should handle applying patches to Sets", () => {
      const base = {
        data: new Set([1, 2]),
      };

      const result = applyPatches(base, [
        {
          op: "add",
          path: ["data", 2],
          value: 3,
        },
      ]);

      expect(result.data.has(3)).toBe(true);
    });

    it("should handle remove patches on Maps", () => {
      const base = {
        data: new Map([
          ["a", 1],
          ["b", 2],
        ]),
      };

      const result = applyPatches(base, [
        {
          op: "remove",
          path: ["data", "a"],
        },
      ]);

      expect(result.data.has("a")).toBe(false);
      expect(result.data.get("b")).toBe(2);
    });

    it("should handle remove patches on Sets", () => {
      const base = {
        data: new Set([1, 2, 3]),
      };

      const result = applyPatches(base, [
        {
          op: "remove",
          path: ["data", 0],
          value: 2,
        },
      ]);

      expect(result.data.has(2)).toBe(false);
    });

    it("should handle deeply nested patch application", () => {
      const base = {
        level1: {
          level2: {
            level3: {
              value: 0,
            },
          },
        },
      };

      const result = applyPatches(base, [
        {
          op: "replace",
          path: ["level1", "level2", "level3", "value"],
          value: 10,
        },
      ]);

      expect(result.level1.level2.level3.value).toBe(10);
    });

    it("should handle nested Map patch application", () => {
      const base = {
        outer: {
          inner: new Map([["key", "value"]]),
        },
      };

      const result = applyPatches(base, [
        {
          op: "add",
          path: ["outer", "inner", "newKey"],
          value: "newValue",
        },
      ]);

      expect(result.outer.inner.get("newKey")).toBe("newValue");
    });
  });

  describe("Utils edge cases", () => {
    it("should use peek to access properties without creating drafts", () => {
      const base = {
        a: 1,
        nested: { b: 2 },
      };

      craft(base, (draft) => {
        const value = peek(draft, "a");
        expect(value).toBe(1);

        const nestedValue = peek(draft, "nested");
        expect(nestedValue.b).toBe(2);
      });
    });

    it("should handle peek on non-draft objects", () => {
      const obj = { count: 5 };
      const value = peek(obj, "count");
      expect(value).toBe(5);
    });

    it("should handle freeze on already frozen objects", () => {
      const obj = Object.freeze({ count: 0 });
      const result = freeze(obj, true);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it("should handle deep freeze", () => {
      const obj = {
        level1: {
          level2: {
            value: 0,
          },
        },
      };

      const frozen = freeze(obj, true);
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.level1)).toBe(true);
      expect(Object.isFrozen(frozen.level1.level2)).toBe(true);
    });

    it("should handle current() with Map/Set in nested structures", () => {
      const base = {
        data: {
          map: new Map([["a", 1]]),
          set: new Set([1, 2]),
        },
      };

      craft(base, (draft) => {
        draft.data.map.set("b", 2);
        draft.data.set.add(3);

        const snapshot = current(draft);
        expect(snapshot.data.map.get("b")).toBe(2);
        expect(snapshot.data.set.has(3)).toBe(true);
      });
    });

    it("should handle finalization of arrays with both nothing and drafts", () => {
      const base = {
        items: [
          { id: 1, name: "A" },
          { id: 2, name: "B" },
          { id: 3, name: "C" },
        ],
      };

      const next = craft(base, (draft) => {
        draft.items[0]!.name = "Updated A";
        // Delete middle item using nothing symbol
        draft.items[1] = nothing as any;
      });

      expect(next.items[0]!.name).toBe("Updated A");
      expect(next.items).toHaveLength(2);
    });

    it("should handle finalization with Maps in arrays", () => {
      const base = {
        items: [new Map([["key", "value"]]), new Map([["key2", "value2"]])],
      };

      const next = craft(base, (draft) => {
        draft.items[0]!.set("newKey", "newValue");
      });

      expect(next.items[0]!.get("newKey")).toBe("newValue");
      expect(base.items[0]!.get("newKey")).toBeUndefined();
    });

    it("should handle finalization with Sets in arrays", () => {
      const base = {
        items: [new Set([1, 2]), new Set([3, 4])],
      };

      const next = craft(base, (draft) => {
        draft.items[0]!.add(5);
      });

      expect(next.items[0]!.has(5)).toBe(true);
      expect(base.items[0]!.has(5)).toBe(false);
    });

    it("should handle finalization with Maps in objects", () => {
      const base = {
        config: {
          settings: new Map([["theme", "dark"]]),
        },
      };

      const next = craft(base, (draft) => {
        draft.config.settings.set("language", "en");
      });

      expect(next.config.settings.get("language")).toBe("en");
    });

    it("should handle finalization with Sets in objects", () => {
      const base = {
        config: {
          flags: new Set(["featureA", "featureB"]),
        },
      };

      const next = craft(base, (draft) => {
        draft.config.flags.add("featureC");
      });

      expect(next.config.flags.has("featureC")).toBe(true);
    });

    it("should handle toString on Map proxies", () => {
      const base = {
        data: new Map([["a", 1]]),
      };

      craft(base, (draft) => {
        // Test accessing non-function properties and methods
        const str = draft.data.toString();
        expect(typeof str).toBe("string");
      });
    });

    it("should handle toString on Set proxies", () => {
      const base = {
        data: new Set([1, 2]),
      };

      craft(base, (draft) => {
        // Test accessing non-function properties and methods
        const str = draft.data.toString();
        expect(typeof str).toBe("string");
      });
    });
  });

  describe("Manual draft API edge cases", () => {
    it("should handle finishDraft with Maps", () => {
      const base = {
        data: new Map([["a", 1]]),
      };

      const draft = createDraft(base);
      draft.data.set("b", 2);
      const result = finishDraft(draft);

      expect(result.data.get("b")).toBe(2);
      expect(base.data.get("b")).toBeUndefined();
    });

    it("should handle finishDraft with Sets", () => {
      const base = {
        data: new Set([1, 2]),
      };

      const draft = createDraft(base);
      draft.data.add(3);
      const result = finishDraft(draft);

      expect(result.data.has(3)).toBe(true);
      expect(base.data.has(3)).toBe(false);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle mixed Map/Set/Array/Object mutations", () => {
      const base = {
        users: new Map([
          ["user1", { name: "Alice", tags: new Set(["admin"]) }],
          ["user2", { name: "Bob", tags: new Set(["user"]) }],
        ]),
        groups: [
          { id: 1, members: new Set(["user1"]) },
          { id: 2, members: new Set(["user2"]) },
        ],
      };

      const [next, patches] = produceWithPatches(base, (draft) => {
        // Modify Map
        const user1 = draft.users.get("user1");
        if (user1) {
          user1.name = "Alice Smith";
          user1.tags.add("superadmin");
        }

        // Modify array of objects with Sets
        draft.groups[0]!.members.add("user2");

        // Add new map entry
        draft.users.set("user3", { name: "Charlie", tags: new Set(["guest"]) });
      });

      expect(next.users.get("user1")?.name).toBe("Alice Smith");
      expect(next.users.get("user1")?.tags.has("superadmin")).toBe(true);
      expect(next.groups[0]!.members.has("user2")).toBe(true);
      expect(next.users.get("user3")?.name).toBe("Charlie");
      expect(patches.length).toBeGreaterThan(0);
    });

    it("should roundtrip complex nested structures with patches", () => {
      const base = {
        config: new Map([
          ["database", { host: "localhost", port: 5432 }],
          ["cache", { enabled: true, ttl: 3600 }],
        ]),
        features: new Set(["auth", "logging"]),
        metadata: {
          version: "1.0.0",
          tags: ["production"],
        },
      };

      const [next, patches, inversePatches] = produceWithPatches(base, (draft) => {
        draft.config.get("database")!.port = 5433;
        draft.features.add("monitoring");
        draft.metadata.tags.push("stable");
      });

      const applied = applyPatches(base, patches);
      expect(applied).toEqual(next);

      const reverted = applyPatches(next, inversePatches);
      expect(reverted).toEqual(base);
    });
  });
});
