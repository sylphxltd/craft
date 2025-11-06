import { beforeEach, describe, expect, it } from "vitest";
import { resetConfig, setAutoFreeze, setUseStrictShallowCopy } from "../src/config";
import { craft } from "../src/craft";
import { createDraft, finishDraft } from "../src/manual";
import { revokeProxy } from "../src/proxy";

describe("Edge cases and coverage", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("should handle non-draftable values (primitives)", () => {
    expect(craft(42, () => {})).toBe(42);
    expect(craft("test", () => {})).toBe("test");
    expect(craft(true, () => {})).toBe(true);
    // Note: null and undefined cannot be used as base in craft
    // They would cause errors in proxy creation
  });

  it("should handle already frozen base object", () => {
    const frozen = Object.freeze({ count: 0 });
    const next = craft(frozen, (draft) => {
      // TypeScript knows frozen is readonly, but craft creates a mutable draft
      (draft as any).count = 1;
    });

    expect(next.count).toBe(1);
    expect(frozen.count).toBe(0);
  });

  it("should handle finalized state (duplicate finalization)", () => {
    const base = { count: 0 };
    const draft = createDraft(base);
    draft.count = 1;

    const result1 = finishDraft(draft);
    const result2 = finishDraft(draft);

    expect(result1).toBe(result2);
    expect(result1.count).toBe(1);
  });

  it("should handle non-modified state with frozen base", () => {
    setAutoFreeze(true);
    const frozen = Object.freeze({ count: 0 });

    const next = craft(frozen, () => {
      // No changes
    });

    expect(next).toBe(frozen);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("should handle nested value that was already replaced", () => {
    const base = {
      user: { name: "Alice", age: 25 },
    };

    const next = craft(base, (draft) => {
      // Replace the entire user object first
      draft.user = { name: "Bob", age: 30 };
      // Access nested property after replacement
      const age = draft.user.age;
      expect(age).toBe(30);
    });

    expect(next.user.name).toBe("Bob");
    expect(next.user.age).toBe(30);
  });

  it("should handle revokeProxy", () => {
    const base = { count: 0 };
    const draft = createDraft(base);

    draft.count = 1;
    revokeProxy(draft);

    const result = finishDraft(draft);
    expect(result.count).toBe(1);
  });

  it("should handle revokeProxy on non-draft", () => {
    const obj = { count: 0 };
    // Should not throw
    revokeProxy(obj);
    expect(obj.count).toBe(0);
  });

  it("should handle useStrictShallowCopy for primitives", () => {
    setUseStrictShallowCopy(true);

    expect(craft(42, () => {})).toBe(42);
    expect(craft("test", () => {})).toBe("test");
    // Primitives are returned as-is
  });

  it("should handle object with custom prototype (non-draftable)", () => {
    class CustomClass {
      value = 10;
    }

    const instance = new CustomClass();
    const base = { custom: instance };

    const next = craft(base, (draft) => {
      // Custom class instances are non-draftable, returned as-is
      expect(draft.custom).toBe(instance);
    });

    // The instance reference is preserved
    expect(next.custom).toBe(instance);
  });

  it("should handle Map and Set (now draftable)", () => {
    const map = new Map([["key", "value"]]);
    const set = new Set([1, 2, 3]);

    // Map/Set are now draftable, so they get proxied
    const nextMap = craft({ map }, (draft) => {
      draft.map.set("key2", "value2");
    });
    expect(nextMap.map.size).toBe(2);
    expect(map.size).toBe(1); // Original unchanged

    const nextSet = craft({ set }, (draft) => {
      draft.set.add(4);
    });
    expect(nextSet.set.size).toBe(4);
    expect(set.size).toBe(3); // Original unchanged
  });

  it("should handle Date objects (non-draftable)", () => {
    const date = new Date();
    const result = craft({ date }, () => {});

    expect(result.date).toBe(date);
  });

  it("should handle array with non-draftable elements", () => {
    const date = new Date();
    const base = { items: [1, "test", date, null] };

    const next = craft(base, (draft) => {
      draft.items.push(42);
    });

    expect(next.items).toHaveLength(5);
    expect(next.items[2]).toBe(date);
    expect(next.items[4]).toBe(42);
  });

  it("should return base when no modifications with autoFreeze=false", () => {
    setAutoFreeze(false);
    const base = { count: 0 };

    const next = craft(base, () => {
      // No changes
    });

    expect(next).toBe(base);
  });

  it("should handle getOwnPropertyDescriptor on non-length properties", () => {
    const base = { count: 0, name: "test" };

    const next = craft(base, (draft) => {
      const desc = Object.getOwnPropertyDescriptor(draft, "count");
      expect(desc?.configurable).toBe(true);
      draft.count = 1;
    });

    expect(next.count).toBe(1);
  });

  it("should handle getOwnPropertyDescriptor on non-existent properties", () => {
    const base = { count: 0 };

    craft(base, (draft) => {
      const desc = Object.getOwnPropertyDescriptor(draft, "nonExistent");
      expect(desc).toBeUndefined();
    });
  });

  it("should handle peek function edge case", () => {
    const base = { a: 1, b: { c: 2 } };

    craft(base, (draft) => {
      // Access nested property through peek (internal)
      const nested = draft.b;
      expect(nested.c).toBe(2);
    });
  });

  it("should handle shallowCopy with primitive return", () => {
    // shallowCopy returns base for primitives
    const num = 42;
    const str = "test";

    expect(craft({ num, str }, () => {}).num).toBe(num);
    expect(craft({ num, str }, () => {}).str).toBe(str);
  });
});
