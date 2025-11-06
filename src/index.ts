/**
 * Craft - A lightweight, functional, and blazingly fast alternative to immer
 *
 * @packageDocumentation
 */

export { craft, crafted } from "./craft";
export { compose, composer, pipe } from "./compose";
export { createDraft, finishDraft } from "./manual";
export { current, freeze, isDraft, original } from "./utils";
export { nothing, type Nothing } from "./nothing";
export { castDraft, castImmutable } from "./cast";
export { setAutoFreeze, setUseStrictShallowCopy, type CraftConfig } from "./config";
export { produceWithPatches } from "./produce-with-patches";
export { applyPatches, type Patch } from "./patches";
export type { Composer, Draft, Immutable, Producer, Primitive } from "./types";

// Default export
export { craft as default } from "./craft";
