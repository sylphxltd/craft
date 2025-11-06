import {
  applyPatches as immerApplyPatches,
  produceWithPatches as immerProduceWithPatches,
} from "immer";
import { bench, describe } from "vitest";
import { applyPatches } from "../src/patches";
import { produceWithPatches } from "../src/produce-with-patches";

describe("Patches generation - Simple updates", () => {
  const baseState = {
    count: 0,
    user: { name: "Alice", age: 25 },
  };

  bench("craft - generate patches (simple update)", () => {
    produceWithPatches(baseState, (draft) => {
      draft.count = 10;
      draft.user.age = 26;
    });
  });

  bench("immer - generate patches (simple update)", () => {
    immerProduceWithPatches(baseState, (draft) => {
      draft.count = 10;
      draft.user.age = 26;
    });
  });
});

describe("Patches generation - Array operations", () => {
  const baseState = {
    items: [1, 2, 3, 4, 5],
  };

  bench("craft - generate patches (array mutations)", () => {
    produceWithPatches(baseState, (draft) => {
      draft.items.push(6);
      draft.items[0] = 10;
    });
  });

  bench("immer - generate patches (array mutations)", () => {
    immerProduceWithPatches(baseState, (draft) => {
      draft.items.push(6);
      draft.items[0] = 10;
    });
  });
});

describe("Patches generation - Nested updates", () => {
  const baseState = {
    level1: {
      level2: {
        level3: {
          value: 0,
          items: [1, 2, 3],
        },
      },
    },
  };

  bench("craft - generate patches (nested)", () => {
    produceWithPatches(baseState, (draft) => {
      draft.level1.level2.level3.value = 100;
      draft.level1.level2.level3.items.push(4);
    });
  });

  bench("immer - generate patches (nested)", () => {
    immerProduceWithPatches(baseState, (draft) => {
      draft.level1.level2.level3.value = 100;
      draft.level1.level2.level3.items.push(4);
    });
  });
});

describe("Patches generation - Map/Set operations", () => {
  const baseState = {
    data: new Map([
      ["a", 1],
      ["b", 2],
    ]),
    tags: new Set([1, 2, 3]),
  };

  bench("craft - generate patches (Map/Set)", () => {
    produceWithPatches(baseState, (draft) => {
      draft.data.set("c", 3);
      draft.tags.add(4);
    });
  });

  bench("immer - generate patches (Map/Set)", () => {
    immerProduceWithPatches(baseState, (draft) => {
      draft.data.set("c", 3);
      draft.tags.add(4);
    });
  });
});

describe("Patches application", () => {
  const baseState = {
    count: 0,
    user: { name: "Alice", age: 25 },
    items: [1, 2, 3],
  };

  const craftPatches = produceWithPatches(baseState, (draft) => {
    draft.count = 10;
    draft.user.age = 26;
    draft.items.push(4);
  })[1];

  const immerPatches = immerProduceWithPatches(baseState, (draft) => {
    draft.count = 10;
    draft.user.age = 26;
    draft.items.push(4);
  })[1];

  bench("craft - apply patches", () => {
    applyPatches(baseState, craftPatches);
  });

  bench("immer - apply patches", () => {
    immerApplyPatches(baseState, immerPatches);
  });
});

describe("Patches roundtrip (generate + apply)", () => {
  const baseState = {
    users: [
      { id: 1, name: "Alice", active: true },
      { id: 2, name: "Bob", active: false },
      { id: 3, name: "Charlie", active: true },
    ],
  };

  bench("craft - patches roundtrip", () => {
    const [_nextState, patches] = produceWithPatches(baseState, (draft) => {
      draft.users[0]!.active = false;
      draft.users[1]!.name = "Robert";
      draft.users.push({ id: 4, name: "David", active: true });
    });
    applyPatches(baseState, patches);
  });

  bench("immer - patches roundtrip", () => {
    const [_nextState, patches] = immerProduceWithPatches(baseState, (draft) => {
      draft.users[0]!.active = false;
      draft.users[1]!.name = "Robert";
      draft.users.push({ id: 4, name: "David", active: true });
    });
    immerApplyPatches(baseState, patches);
  });
});

describe("Undo/Redo simulation", () => {
  const baseState = {
    editor: {
      content: "Hello World",
      cursor: 0,
      history: [] as string[],
    },
  };

  bench("craft - undo/redo with inverse patches", () => {
    const [next1, _patches1, _inverse1] = produceWithPatches(baseState, (draft) => {
      draft.editor.content = "Hello World!";
      draft.editor.cursor = 12;
    });

    const [next2, patches2, inverse2] = produceWithPatches(next1, (draft) => {
      draft.editor.content = "Hello World!!";
      draft.editor.cursor = 13;
    });

    // Undo
    applyPatches(next2, inverse2);
    // Redo
    applyPatches(next1, patches2);
  });

  bench("immer - undo/redo with inverse patches", () => {
    const [next1, _patches1, _inverse1] = immerProduceWithPatches(baseState, (draft) => {
      draft.editor.content = "Hello World!";
      draft.editor.cursor = 12;
    });

    const [next2, patches2, inverse2] = immerProduceWithPatches(next1, (draft) => {
      draft.editor.content = "Hello World!!";
      draft.editor.cursor = 13;
    });

    // Undo
    immerApplyPatches(next2, inverse2);
    // Redo
    immerApplyPatches(next1, patches2);
  });
});

describe("Large state patches", () => {
  const createLargeState = () => ({
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: i * 10,
    })),
  });

  const largeState = createLargeState();

  bench("craft - patches for large state", () => {
    produceWithPatches(largeState, (draft) => {
      draft.items[10]!.value = 999;
      draft.items[50]!.name = "Updated Item";
      draft.items.push({ id: 100, name: "New Item", value: 1000 });
    });
  });

  bench("immer - patches for large state", () => {
    immerProduceWithPatches(largeState, (draft) => {
      draft.items[10]!.value = 999;
      draft.items[50]!.name = "Updated Item";
      draft.items.push({ id: 100, name: "New Item", value: 1000 });
    });
  });
});
