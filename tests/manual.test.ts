import { describe, expect, it } from "vitest";
import { createDraft, finishDraft } from "../src/manual";
import { isDraft } from "../src/utils";

describe("createDraft", () => {
  it("should create a mutable draft", () => {
    const base = { count: 0, name: "Alice" };
    const draft = createDraft(base);

    expect(isDraft(draft)).toBe(true);
    expect(draft.count).toBe(0);
    expect(draft.name).toBe("Alice");
  });

  it("should allow mutations on draft", () => {
    const base = { count: 0 };
    const draft = createDraft(base);

    draft.count = 10;

    expect(draft.count).toBe(10);
    expect(base.count).toBe(0);
  });

  it("should handle nested objects", () => {
    const base = { user: { name: "Alice", age: 25 } };
    const draft = createDraft(base);

    draft.user.age = 26;
    draft.user.name = "Bob";

    expect(draft.user.age).toBe(26);
    expect(base.user.age).toBe(25);
  });

  it("should handle arrays", () => {
    const base = { items: [1, 2, 3] };
    const draft = createDraft(base);

    draft.items.push(4);
    draft.items[0] = 10;

    expect(draft.items).toEqual([10, 2, 3, 4]);
    expect(base.items).toEqual([1, 2, 3]);
  });
});

describe("finishDraft", () => {
  it("should finalize draft to immutable state", () => {
    const base = { count: 0 };
    const draft = createDraft(base);

    draft.count = 10;

    const next = finishDraft(draft);

    expect(next.count).toBe(10);
    expect(base.count).toBe(0);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("should return same object if no changes", () => {
    const base = { count: 0 };
    const draft = createDraft(base);

    const next = finishDraft(draft);

    expect(next).toBe(base);
  });

  it("should handle complex mutations", () => {
    const base = {
      todos: [
        { id: 1, text: "Task 1", done: false },
        { id: 2, text: "Task 2", done: false },
      ],
      filter: "all" as string,
    };

    const draft = createDraft(base);

    draft.todos[0]!.done = true;
    draft.todos.push({ id: 3, text: "Task 3", done: false });
    draft.filter = "active";

    const next = finishDraft(draft);

    expect(next.todos).toHaveLength(3);
    expect(next.todos[0]!.done).toBe(true);
    expect(next.filter).toBe("active");
    expect(base.todos).toHaveLength(2);
    expect(base.todos[0]!.done).toBe(false);
  });

  it("should preserve structural sharing", () => {
    const base = {
      a: { value: 1 },
      b: { value: 2 },
      c: { value: 3 },
    };

    const draft = createDraft(base);
    draft.a.value = 10;

    const next = finishDraft(draft);

    expect(next.a).not.toBe(base.a);
    expect(next.b).toBe(base.b);
    expect(next.c).toBe(base.c);
  });

  it("should return non-draft values as-is", () => {
    const obj = { count: 0 };
    const result = finishDraft(obj);

    expect(result).toBe(obj);
  });
});

describe("manual draft workflow", () => {
  it("should support async operations", async () => {
    const base = { count: 0, data: null as any };

    const draft = createDraft(base);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
    draft.count = 10;

    await new Promise((resolve) => setTimeout(resolve, 10));
    draft.data = { loaded: true };

    const next = finishDraft(draft);

    expect(next.count).toBe(10);
    expect(next.data).toEqual({ loaded: true });
  });

  it("should support incremental updates", () => {
    const base = { items: [] as number[] };

    const draft = createDraft(base);

    for (let i = 1; i <= 5; i++) {
      draft.items.push(i);
    }

    const next = finishDraft(draft);

    expect(next.items).toEqual([1, 2, 3, 4, 5]);
    expect(base.items).toEqual([]);
  });

  it("should allow conditional mutations", () => {
    const base = { count: 0, status: "idle" as string };

    const draft = createDraft(base);

    if (draft.count === 0) {
      draft.status = "ready";
    }

    draft.count++;

    if (draft.count > 0) {
      draft.status = "active";
    }

    const next = finishDraft(draft);

    expect(next.count).toBe(1);
    expect(next.status).toBe("active");
  });
});
