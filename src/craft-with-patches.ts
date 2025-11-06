/**
 * Craft with patches - generates state along with patches describing changes
 */

import { createDraft, finishDraft } from "./manual";
import { type Patch, generatePatches } from "./patches";
import type { Producer } from "./types";

/**
 * Craft a new state and generate patches describing the changes
 *
 * @param base - The base state
 * @param producer - Function that modifies the draft
 * @returns Tuple of [nextState, patches, inversePatches]
 *
 * @example
 * ```ts
 * const [nextState, patches, inversePatches] = craftWithPatches(state, draft => {
 *   draft.count++;
 * });
 *
 * // patches: [{ op: 'replace', path: ['count'], value: 1 }]
 * // inversePatches: [{ op: 'replace', path: ['count'], value: 0 }]
 * ```
 */
export function craftWithPatches<T>(base: T, producer: Producer<T>): [T, Patch[], Patch[]] {
  const draft = createDraft(base) as any;
  const result = producer(draft);
  const nextState = result !== undefined ? result : finishDraft(draft);

  const patches: Patch[] = [];
  const inversePatches: Patch[] = [];

  // Generate patches by comparing base and next state
  generatePatches(base, nextState, patches, inversePatches);

  return [nextState, patches, inversePatches];
}
