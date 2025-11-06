import { beforeEach, describe, expect, it } from "vitest";
import { resetConfig } from "../src/config";
import { craft } from "../src/craft";
import { createDraft, finishDraft } from "../src/manual";
import { current, original } from "../src/utils";

describe("Map mutation tracking", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("should handle Map.set()", () => {
    const base = {
      data: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    };

    const next = craft(base, (draft) => {
      draft.data.set("c", 3);
      draft.data.set("a", 10);
    });

    expect(next.data.get("a")).toBe(10);
    expect(next.data.get("b")).toBe(2);
    expect(next.data.get("c")).toBe(3);
    expect(next.data.size).toBe(3);

    // Original unchanged
    expect(base.data.get("a")).toBe(1);
    expect(base.data.size).toBe(2);
  });

  it("should handle Map.delete()", () => {
    const base = {
      data: new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    };

    const next = craft(base, (draft) => {
      const deleted = draft.data.delete("b");
      expect(deleted).toBe(true);
    });

    expect(next.data.size).toBe(2);
    expect(next.data.has("b")).toBe(false);
    expect(next.data.get("a")).toBe(1);
    expect(next.data.get("c")).toBe(3);

    // Original unchanged
    expect(base.data.size).toBe(3);
    expect(base.data.has("b")).toBe(true);
  });

  it("should handle Map.clear()", () => {
    const base = {
      data: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    };

    const next = craft(base, (draft) => {
      draft.data.clear();
    });

    expect(next.data.size).toBe(0);
    expect(base.data.size).toBe(2);
  });

  it("should handle Map.get() and Map.has()", () => {
    const base = {
      data: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    };

    craft(base, (draft) => {
      expect(draft.data.get("a")).toBe(1);
      expect(draft.data.has("a")).toBe(true);
      expect(draft.data.has("c")).toBe(false);
    });
  });

  it("should handle Map iteration methods", () => {
    const base = {
      data: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    };

    craft(base, (draft) => {
      draft.data.set("c", 3);

      const keys = Array.from(draft.data.keys());
      expect(keys).toEqual(["a", "b", "c"]);

      const values = Array.from(draft.data.values());
      expect(values).toEqual([1, 2, 3]);

      const entries = Array.from(draft.data.entries());
      expect(entries).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);

      const collected: [string, number][] = [];
      draft.data.forEach((value, key) => {
        collected.push([key, value]);
      });
      expect(collected).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
    });
  });

  it("should handle Map with Symbol.iterator", () => {
    const base = {
      data: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    };

    craft(base, (draft) => {
      draft.data.set("c", 3);
      const entries = Array.from(draft.data);
      expect(entries).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
    });
  });

  it("should return base when Map is not modified", () => {
    const base = {
      data: new Map([["a", 1]]),
    };

    const next = craft(base, (draft) => {
      // Read only
      draft.data.get("a");
      draft.data.has("a");
    });

    expect(next).toBe(base);
  });

  it("should work with manual draft API", () => {
    const base = {
      data: new Map([["a", 1]]),
    };

    const draft = createDraft(base);
    draft.data.set("b", 2);
    const next = finishDraft(draft);

    expect(next.data.size).toBe(2);
    expect(base.data.size).toBe(1);
  });

  it("should support current() with Map", () => {
    const base = {
      data: new Map([["a", 1]]),
    };

    craft(base, (draft) => {
      draft.data.set("b", 2);
      const snapshot = current(draft);
      expect(snapshot.data.size).toBe(2);
      expect(snapshot.data.get("b")).toBe(2);
    });
  });

  it("should support original() with Map", () => {
    const base = {
      data: new Map([["a", 1]]),
    };

    craft(base, (draft) => {
      draft.data.set("b", 2);
      const orig = original(draft);
      expect(orig?.data.size).toBe(1);
      expect(orig?.data.has("b")).toBe(false);
    });
  });
});

describe("Set mutation tracking", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("should handle Set.add()", () => {
    const base = {
      data: new Set([1, 2, 3]),
    };

    const next = craft(base, (draft) => {
      draft.data.add(4);
      draft.data.add(5);
    });

    expect(next.data.size).toBe(5);
    expect(next.data.has(4)).toBe(true);
    expect(next.data.has(5)).toBe(true);

    // Original unchanged
    expect(base.data.size).toBe(3);
    expect(base.data.has(4)).toBe(false);
  });

  it("should handle Set.delete()", () => {
    const base = {
      data: new Set([1, 2, 3]),
    };

    const next = craft(base, (draft) => {
      const deleted = draft.data.delete(2);
      expect(deleted).toBe(true);
    });

    expect(next.data.size).toBe(2);
    expect(next.data.has(2)).toBe(false);
    expect(next.data.has(1)).toBe(true);
    expect(next.data.has(3)).toBe(true);

    // Original unchanged
    expect(base.data.size).toBe(3);
    expect(base.data.has(2)).toBe(true);
  });

  it("should handle Set.clear()", () => {
    const base = {
      data: new Set([1, 2, 3]),
    };

    const next = craft(base, (draft) => {
      draft.data.clear();
    });

    expect(next.data.size).toBe(0);
    expect(base.data.size).toBe(3);
  });

  it("should handle Set.has()", () => {
    const base = {
      data: new Set([1, 2, 3]),
    };

    craft(base, (draft) => {
      expect(draft.data.has(1)).toBe(true);
      expect(draft.data.has(2)).toBe(true);
      expect(draft.data.has(4)).toBe(false);
    });
  });

  it("should handle Set iteration methods", () => {
    const base = {
      data: new Set([1, 2]),
    };

    craft(base, (draft) => {
      draft.data.add(3);

      const keys = Array.from(draft.data.keys());
      expect(keys).toEqual([1, 2, 3]);

      const values = Array.from(draft.data.values());
      expect(values).toEqual([1, 2, 3]);

      const entries = Array.from(draft.data.entries());
      expect(entries).toEqual([
        [1, 1],
        [2, 2],
        [3, 3],
      ]);

      const collected: number[] = [];
      draft.data.forEach((value) => {
        collected.push(value);
      });
      expect(collected).toEqual([1, 2, 3]);
    });
  });

  it("should handle Set with Symbol.iterator", () => {
    const base = {
      data: new Set([1, 2]),
    };

    craft(base, (draft) => {
      draft.data.add(3);
      const values = Array.from(draft.data);
      expect(values).toEqual([1, 2, 3]);
    });
  });

  it("should return base when Set is not modified", () => {
    const base = {
      data: new Set([1, 2]),
    };

    const next = craft(base, (draft) => {
      // Read only
      draft.data.has(1);
    });

    expect(next).toBe(base);
  });

  it("should work with manual draft API", () => {
    const base = {
      data: new Set([1, 2]),
    };

    const draft = createDraft(base);
    draft.data.add(3);
    const next = finishDraft(draft);

    expect(next.data.size).toBe(3);
    expect(base.data.size).toBe(2);
  });

  it("should support current() with Set", () => {
    const base = {
      data: new Set([1, 2]),
    };

    craft(base, (draft) => {
      draft.data.add(3);
      const snapshot = current(draft);
      expect(snapshot.data.size).toBe(3);
      expect(snapshot.data.has(3)).toBe(true);
    });
  });

  it("should support original() with Set", () => {
    const base = {
      data: new Set([1, 2]),
    };

    craft(base, (draft) => {
      draft.data.add(3);
      const orig = original(draft);
      expect(orig?.data.size).toBe(2);
      expect(orig?.data.has(3)).toBe(false);
    });
  });
});

describe("Nested Map/Set mutations", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("should handle nested Maps in arrays", () => {
    const base = {
      items: [new Map([["a", 1]]), new Map([["b", 2]])],
    };

    const next = craft(base, (draft) => {
      draft.items[0]!.set("c", 3);
    });

    expect(next.items[0]!.get("c")).toBe(3);
    expect(next.items[0]!.size).toBe(2);
    expect(base.items[0]!.size).toBe(1);
  });

  it("should handle nested Sets in arrays", () => {
    const base = {
      items: [new Set([1, 2]), new Set([3, 4])],
    };

    const next = craft(base, (draft) => {
      draft.items[0]!.add(5);
    });

    expect(next.items[0]!.has(5)).toBe(true);
    expect(next.items[0]!.size).toBe(3);
    expect(base.items[0]!.size).toBe(2);
  });

  it("should handle Map/Set combination", () => {
    const base = {
      mapData: new Map([["key1", new Set([1, 2])]]),
    };

    craft(base, (draft) => {
      const set = draft.mapData.get("key1");
      if (set) {
        set.add(3);
      }
      draft.mapData.set("key2", new Set([4, 5]));

      expect(draft.mapData.get("key1")?.size).toBe(3);
      expect(draft.mapData.get("key2")?.size).toBe(2);
    });
  });
});
