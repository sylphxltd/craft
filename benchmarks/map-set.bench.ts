import { produce as immerProduce } from "immer";
import { bench, describe } from "vitest";
import { craft } from "../src/craft";

describe("Map operations", () => {
  const baseState = {
    data: new Map([
      ["key1", "value1"],
      ["key2", "value2"],
      ["key3", "value3"],
    ]),
  };

  bench("craft - Map.set()", () => {
    craft(baseState, (draft) => {
      draft.data.set("key4", "value4");
      draft.data.set("key5", "value5");
    });
  });

  bench("immer - Map.set()", () => {
    immerProduce(baseState, (draft) => {
      draft.data.set("key4", "value4");
      draft.data.set("key5", "value5");
    });
  });

  bench("craft - Map.delete()", () => {
    craft(baseState, (draft) => {
      draft.data.delete("key1");
    });
  });

  bench("immer - Map.delete()", () => {
    immerProduce(baseState, (draft) => {
      draft.data.delete("key1");
    });
  });

  bench("craft - Map update value", () => {
    craft(baseState, (draft) => {
      draft.data.set("key1", "updated");
    });
  });

  bench("immer - Map update value", () => {
    immerProduce(baseState, (draft) => {
      draft.data.set("key1", "updated");
    });
  });
});

describe("Set operations", () => {
  const baseState = {
    data: new Set([1, 2, 3, 4, 5]),
  };

  bench("craft - Set.add()", () => {
    craft(baseState, (draft) => {
      draft.data.add(6);
      draft.data.add(7);
    });
  });

  bench("immer - Set.add()", () => {
    immerProduce(baseState, (draft) => {
      draft.data.add(6);
      draft.data.add(7);
    });
  });

  bench("craft - Set.delete()", () => {
    craft(baseState, (draft) => {
      draft.data.delete(3);
    });
  });

  bench("immer - Set.delete()", () => {
    immerProduce(baseState, (draft) => {
      draft.data.delete(3);
    });
  });
});

describe("Nested Map/Set operations", () => {
  const baseState = {
    users: new Map([
      ["user1", { name: "Alice", roles: new Set(["admin", "user"]) }],
      ["user2", { name: "Bob", roles: new Set(["user"]) }],
      ["user3", { name: "Charlie", roles: new Set(["guest"]) }],
    ]),
  };

  bench("craft - nested Map and Set mutations", () => {
    craft(baseState, (draft) => {
      const user1 = draft.users.get("user1");
      if (user1) {
        user1.name = "Alice Smith";
        user1.roles.add("superadmin");
      }
      draft.users.set("user4", { name: "David", roles: new Set(["user"]) });
    });
  });

  bench("immer - nested Map and Set mutations", () => {
    immerProduce(baseState, (draft) => {
      const user1 = draft.users.get("user1");
      if (user1) {
        user1.name = "Alice Smith";
        user1.roles.add("superadmin");
      }
      draft.users.set("user4", { name: "David", roles: new Set(["user"]) });
    });
  });
});

describe("Large Map/Set operations", () => {
  const createLargeMap = (size: number) => {
    const map = new Map();
    for (let i = 0; i < size; i++) {
      map.set(`key${i}`, `value${i}`);
    }
    return { data: map };
  };

  const createLargeSet = (size: number) => {
    const set = new Set();
    for (let i = 0; i < size; i++) {
      set.add(i);
    }
    return { data: set };
  };

  const largeMapState = createLargeMap(100);
  const largeSetState = createLargeSet(100);

  bench("craft - large Map update (100 items)", () => {
    craft(largeMapState, (draft) => {
      draft.data.set("new1", "newValue1");
      draft.data.set("new2", "newValue2");
    });
  });

  bench("immer - large Map update (100 items)", () => {
    immerProduce(largeMapState, (draft) => {
      draft.data.set("new1", "newValue1");
      draft.data.set("new2", "newValue2");
    });
  });

  bench("craft - large Set update (100 items)", () => {
    craft(largeSetState, (draft) => {
      draft.data.add(1000);
      draft.data.add(1001);
    });
  });

  bench("immer - large Set update (100 items)", () => {
    immerProduce(largeSetState, (draft) => {
      draft.data.add(1000);
      draft.data.add(1001);
    });
  });
});

describe("Read-only Map/Set operations (no changes)", () => {
  const baseState = {
    map: new Map([
      ["a", 1],
      ["b", 2],
    ]),
    set: new Set([1, 2, 3]),
  };

  bench("craft - Map read-only", () => {
    craft(baseState, (draft) => {
      draft.map.get("a");
      draft.map.has("b");
    });
  });

  bench("immer - Map read-only", () => {
    immerProduce(baseState, (draft) => {
      draft.map.get("a");
      draft.map.has("b");
    });
  });

  bench("craft - Set read-only", () => {
    craft(baseState, (draft) => {
      draft.set.has(1);
      draft.set.has(2);
    });
  });

  bench("immer - Set read-only", () => {
    immerProduce(baseState, (draft) => {
      draft.set.has(1);
      draft.set.has(2);
    });
  });
});
