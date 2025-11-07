import { produce } from "immer";
import { bench, describe } from "vitest";
import { craft, setCustomShallowCopy } from "../src";

// Custom class for testing
class CustomClass {
  constructor(
    public id: number,
    public data: string,
  ) {}

  clone(): CustomClass {
    return new CustomClass(this.id, this.data);
  }
}

describe("Custom shallow copy", () => {
  const stateWithCustomClass = {
    count: 0,
    custom: new CustomClass(1, "test data"),
    items: [1, 2, 3],
  };

  // Test with custom shallow copy
  describe("With custom copy function", () => {
    beforeAll(() => {
      setCustomShallowCopy((value, defaultCopy) => {
        if (value instanceof CustomClass) {
          return value.clone();
        }
        return defaultCopy(value);
      });
    });

    afterAll(() => {
      setCustomShallowCopy(undefined);
    });

    bench("craft - update with custom class", () => {
      craft(stateWithCustomClass, (draft) => {
        draft.count++;
        draft.custom.data = "updated";
      });
    });
  });

  // Test without custom shallow copy (baseline)
  describe("Without custom copy function", () => {
    bench("craft - update without custom copy", () => {
      craft(stateWithCustomClass, (draft) => {
        draft.count++;
      });
    });

    bench("immer - update (baseline)", () => {
      produce(stateWithCustomClass, (draft) => {
        draft.count++;
      });
    });
  });
});

describe("Custom shallow copy with complex objects", () => {
  class ComplexObject {
    private cache = new Map<string, any>();

    constructor(public data: Record<string, any>) {}

    clone(): ComplexObject {
      const cloned = new ComplexObject({ ...this.data });
      // Don't clone cache - new instance gets fresh cache
      return cloned;
    }

    get(key: string): any {
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      const value = this.data[key];
      this.cache.set(key, value);
      return value;
    }
  }

  const complexState = {
    objects: Array.from({ length: 100 }, (_, i) => new ComplexObject({ id: i, value: i * 10 })),
  };

  describe("With custom complex object copy", () => {
    beforeAll(() => {
      setCustomShallowCopy((value, defaultCopy) => {
        if (value instanceof ComplexObject) {
          return value.clone();
        }
        return defaultCopy(value);
      });
    });

    afterAll(() => {
      setCustomShallowCopy(undefined);
    });

    bench("craft - update array of complex objects", () => {
      craft(complexState, (draft) => {
        draft.objects[50]!.data.value = 999;
      });
    });
  });
});

describe("Performance impact of custom shallow copy", () => {
  const simpleState = {
    count: 0,
    name: "test",
    items: Array.from({ length: 100 }, (_, i) => ({ id: i, value: i })),
  };

  bench("craft - baseline (no custom copy)", () => {
    craft(simpleState, (draft) => {
      draft.count++;
      draft.items[50]!.value = 999;
    });
  });

  describe("With identity custom copy (no-op)", () => {
    beforeAll(() => {
      setCustomShallowCopy((value, defaultCopy) => {
        // Just pass through to default - measures overhead
        return defaultCopy(value);
      });
    });

    afterAll(() => {
      setCustomShallowCopy(undefined);
    });

    bench("craft - with identity custom copy (overhead test)", () => {
      craft(simpleState, (draft) => {
        draft.count++;
        draft.items[50]!.value = 999;
      });
    });
  });
});
