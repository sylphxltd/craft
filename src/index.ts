/**
 * Craft - A lightweight, functional, and blazingly fast alternative to immer
 *
 * @packageDocumentation
 */

// Core APIs
export { craft, crafted } from "./craft";
export { compose, composer, pipe } from "./compose";
export { createDraft, finishDraft } from "./manual";

// Utility APIs
export { current, freeze, isDraft, isDraftable, original } from "./utils";
export { nothing, type Nothing } from "./nothing";
export { castDraft, castImmutable } from "./cast";

// Configuration APIs
export {
  setAutoFreeze,
  setUseStrictShallowCopy,
  setCustomShallowCopy,
  type CraftConfig,
} from "./config";

// Patches APIs
export { craftWithPatches } from "./craft-with-patches";
export { applyPatches, type Patch } from "./patches";

// Type exports
export type { Composer, Draft, Immutable, Producer, Primitive } from "./types";

// Aliases for immer compatibility
export { craft as produce } from "./craft";
export { craftWithPatches as produceWithPatches } from "./craft-with-patches";

// Default export
export { craft as default } from "./craft";
