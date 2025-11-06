/**
 * Manual draft control for advanced use cases
 */

import { createProxy } from "./proxy";
import { finalize, getState } from "./utils";

/**
 * Create a draft that can be modified manually
 * Must call finishDraft() when done to get the final result
 *
 * @param base - The base state to create a draft from
 * @returns A mutable draft
 *
 * @example
 * ```ts
 * const draft = createDraft(state);
 * draft.count++;
 * draft.items.push(4);
 * const next = finishDraft(draft);
 * ```
 */
export function createDraft<T>(base: T): T {
  return createProxy(base, null);
}

/**
 * Finalize a draft created with createDraft()
 *
 * @param draft - The draft to finalize
 * @returns The final immutable state
 *
 * @example
 * ```ts
 * const draft = createDraft(state);
 * draft.count++;
 * const next = finishDraft(draft);
 * ```
 */
export function finishDraft<T>(draft: T): T {
  const state = getState(draft);
  if (!state) {
    // Not a draft, return as-is
    return draft;
  }

  return finalize(state, true);
}
