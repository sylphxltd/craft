import { produce } from "immer";
import { bench, describe } from "vitest";
import { craft } from "../src/craft";

describe("Very large arrays (1000 items)", () => {
  const veryLargeArray = Array.from({ length: 1000 }, (_, i) => i);

  bench("craft - push to 1000-item array", () => {
    craft({ items: veryLargeArray }, (draft) => {
      draft.items.push(999);
    });
  });

  bench("immer - push to 1000-item array", () => {
    produce({ items: veryLargeArray }, (draft) => {
      draft.items.push(999);
    });
  });

  bench("craft - update element in 1000-item array", () => {
    craft({ items: veryLargeArray }, (draft) => {
      draft.items[500] = 9999;
    });
  });

  bench("immer - update element in 1000-item array", () => {
    produce({ items: veryLargeArray }, (draft) => {
      draft.items[500] = 9999;
    });
  });
});

describe("Extremely large arrays (5000 items)", () => {
  const extremelyLargeArray = Array.from({ length: 5000 }, (_, i) => i);

  bench("craft - push to 5000-item array", () => {
    craft({ items: extremelyLargeArray }, (draft) => {
      draft.items.push(9999);
    });
  });

  bench("immer - push to 5000-item array", () => {
    produce({ items: extremelyLargeArray }, (draft) => {
      draft.items.push(9999);
    });
  });

  bench("craft - update element in 5000-item array", () => {
    craft({ items: extremelyLargeArray }, (draft) => {
      draft.items[2500] = 99999;
    });
  });

  bench("immer - update element in 5000-item array", () => {
    produce({ items: extremelyLargeArray }, (draft) => {
      draft.items[2500] = 99999;
    });
  });

  bench("craft - multiple updates in 5000-item array", () => {
    craft({ items: extremelyLargeArray }, (draft) => {
      draft.items[100] = 1;
      draft.items[1000] = 2;
      draft.items[2000] = 3;
      draft.items[3000] = 4;
      draft.items[4000] = 5;
    });
  });

  bench("immer - multiple updates in 5000-item array", () => {
    produce({ items: extremelyLargeArray }, (draft) => {
      draft.items[100] = 1;
      draft.items[1000] = 2;
      draft.items[2000] = 3;
      draft.items[3000] = 4;
      draft.items[4000] = 5;
    });
  });
});

describe("Large arrays with nested objects (1000 items)", () => {
  const largeArrayOfObjects = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: i * 10,
    metadata: { created: Date.now(), updated: Date.now() },
  }));

  bench("craft - update nested object in 1000-item array", () => {
    craft({ items: largeArrayOfObjects }, (draft) => {
      draft.items[500]!.value = 99999;
      draft.items[500]!.metadata.updated = Date.now();
    });
  });

  bench("immer - update nested object in 1000-item array", () => {
    produce({ items: largeArrayOfObjects }, (draft) => {
      draft.items[500]!.value = 99999;
      draft.items[500]!.metadata.updated = Date.now();
    });
  });

  bench("craft - add to 1000-item array of objects", () => {
    craft({ items: largeArrayOfObjects }, (draft) => {
      draft.items.push({
        id: 1000,
        name: "Item 1000",
        value: 10000,
        metadata: { created: Date.now(), updated: Date.now() },
      });
    });
  });

  bench("immer - add to 1000-item array of objects", () => {
    produce({ items: largeArrayOfObjects }, (draft) => {
      draft.items.push({
        id: 1000,
        name: "Item 1000",
        value: 10000,
        metadata: { created: Date.now(), updated: Date.now() },
      });
    });
  });
});

describe("Large array bulk operations", () => {
  const largeArray = Array.from({ length: 2000 }, (_, i) => i);

  bench("craft - bulk update (update every 10th element)", () => {
    craft({ items: largeArray }, (draft) => {
      for (let i = 0; i < draft.items.length; i += 10) {
        draft.items[i] = draft.items[i]! * 2;
      }
    });
  });

  bench("immer - bulk update (update every 10th element)", () => {
    produce({ items: largeArray }, (draft) => {
      for (let i = 0; i < draft.items.length; i += 10) {
        draft.items[i] = draft.items[i]! * 2;
      }
    });
  });

  bench("craft - sparse update (update 10 random elements)", () => {
    craft({ items: largeArray }, (draft) => {
      const indices = [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900];
      for (const i of indices) {
        draft.items[i] = draft.items[i]! * 2;
      }
    });
  });

  bench("immer - sparse update (update 10 random elements)", () => {
    produce({ items: largeArray }, (draft) => {
      const indices = [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900];
      for (const i of indices) {
        draft.items[i] = draft.items[i]! * 2;
      }
    });
  });
});
