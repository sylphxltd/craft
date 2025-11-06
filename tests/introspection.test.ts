import { describe, expect, it } from "vitest";
import { craft } from "../src/craft";
import { current, isDraft, original } from "../src/utils";

describe("isDraft", () => {
  it("should identify draft values", () => {
    const base = { count: 0 };

    craft(base, (draft) => {
      expect(isDraft(draft)).toBe(true);
      expect(isDraft(base)).toBe(false);
      expect(isDraft(draft.count)).toBe(false);
    });
  });

  it("should identify nested drafts", () => {
    const base = { user: { name: "Alice" } };

    craft(base, (draft) => {
      expect(isDraft(draft)).toBe(true);
      expect(isDraft(draft.user)).toBe(true);
    });
  });

  it("should return false for primitives", () => {
    expect(isDraft(42)).toBe(false);
    expect(isDraft("hello")).toBe(false);
    expect(isDraft(null)).toBe(false);
    expect(isDraft(undefined)).toBe(false);
  });
});

describe("original", () => {
  it("should return original value of a draft", () => {
    const base = { count: 0, name: "Alice" };

    craft(base, (draft) => {
      draft.count = 10;
      draft.name = "Bob";

      const orig = original(draft);
      expect(orig?.count).toBe(0);
      expect(orig?.name).toBe("Alice");
      expect(draft.count).toBe(10);
      expect(draft.name).toBe("Bob");
    });
  });

  it("should return original value of nested draft", () => {
    const base = { user: { name: "Alice", age: 25 } };

    craft(base, (draft) => {
      draft.user.age = 26;

      const origUser = original(draft.user);
      expect(origUser?.age).toBe(25);
      expect(draft.user.age).toBe(26);
    });
  });

  it("should return undefined for non-draft values", () => {
    const obj = { count: 0 };
    expect(original(obj)).toBeUndefined();
  });

  it("should be useful for comparisons", () => {
    const base = { items: [1, 2, 3] };

    const next = craft(base, (draft) => {
      const origLength = original(draft)?.items.length;
      draft.items.push(4);
      const newLength = draft.items.length;

      expect(origLength).toBe(3);
      expect(newLength).toBe(4);
    });

    expect(next.items.length).toBe(4);
  });
});

describe("current", () => {
  it("should return immutable snapshot of draft", () => {
    const base = { count: 0, items: [1, 2] };

    craft(base, (draft) => {
      draft.count = 10;
      draft.items.push(3);

      const snapshot = current(draft);

      expect(snapshot.count).toBe(10);
      expect(snapshot.items).toEqual([1, 2, 3]);
      expect(Object.isFrozen(snapshot)).toBe(true);
    });
  });

  it("should handle nested objects", () => {
    const base = { user: { name: "Alice", profile: { age: 25 } } };

    craft(base, (draft) => {
      draft.user.profile.age = 26;

      const snapshot = current(draft);

      expect(snapshot.user.profile.age).toBe(26);
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.user)).toBe(true);
      expect(Object.isFrozen(snapshot.user.profile)).toBe(true);
    });
  });

  it("should return non-draft values as-is", () => {
    const obj = { count: 0 };
    const result = current(obj);

    expect(result).toBe(obj);
  });

  it("should allow passing snapshot outside producer", () => {
    const base = { items: [1, 2] };
    let snapshot: typeof base | null = null;

    craft(base, (draft) => {
      draft.items.push(3);
      snapshot = current(draft);
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot!.items).toEqual([1, 2, 3]);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("should deeply freeze nested structures", () => {
    const base = { level1: { level2: { level3: { value: 1 } } } };

    craft(base, (draft) => {
      draft.level1.level2.level3.value = 2;

      const snapshot = current(draft);

      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.level1)).toBe(true);
      expect(Object.isFrozen(snapshot.level1.level2)).toBe(true);
      expect(Object.isFrozen(snapshot.level1.level2.level3)).toBe(true);
    });
  });
});

describe("introspection combined usage", () => {
  it("should work together for debugging", () => {
    const base = { count: 0, items: [1, 2, 3] };

    craft(base, (draft) => {
      // Check if value is a draft
      expect(isDraft(draft)).toBe(true);

      // Get original value for comparison
      const origCount = original(draft)?.count;
      expect(origCount).toBe(0);

      // Make changes
      draft.count = 10;
      draft.items.push(4);

      // Get current snapshot
      const snapshot = current(draft);
      expect(snapshot.count).toBe(10);
      expect(snapshot.items).toEqual([1, 2, 3, 4]);

      // Original is still unchanged
      expect(original(draft)?.count).toBe(0);
      expect(original(draft)?.items).toEqual([1, 2, 3]);
    });
  });
});
