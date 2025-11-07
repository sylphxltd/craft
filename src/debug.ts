/**
 * Debugging and inspection utilities for Craft
 * Provides enhanced debugging capabilities for development
 */

import { getMapState, getSetState } from "./map-set";
import { getState, isDraft } from "./utils";

export interface ChangeMetadata {
  path: (string | symbol)[];
  type: "add" | "update" | "delete";
  oldValue?: any;
  newValue?: any;
}

export interface DraftInspection {
  isDraft: boolean;
  isModified: boolean;
  isFinalized: boolean;
  type: "object" | "array" | "map" | "set" | "unknown";
  depth: number;
  childDraftCount: number;
  changes: ChangeMetadata[];
}

/**
 * Debug mode configuration
 */
export interface DebugConfig {
  /**
   * Enable debug mode globally
   * @default false
   */
  enabled: boolean;

  /**
   * Log changes to console as they happen
   * @default false
   */
  logChanges: boolean;

  /**
   * Track change metadata (has performance cost)
   * @default false
   */
  trackChanges: boolean;

  /**
   * Capture stack traces for changes (expensive!)
   * @default false
   */
  captureStackTraces: boolean;
}

const defaultDebugConfig: DebugConfig = {
  enabled: false,
  logChanges: false,
  trackChanges: false,
  captureStackTraces: false,
};

let debugConfig: DebugConfig = { ...defaultDebugConfig };

/**
 * Enable debug mode with optional configuration
 *
 * @param config - Debug configuration options
 *
 * @example
 * ```ts
 * import { enableDebugMode } from "@sylphx/craft";
 *
 * // Enable with all features
 * enableDebugMode({
 *   enabled: true,
 *   logChanges: true,
 *   trackChanges: true,
 * });
 * ```
 */
export function enableDebugMode(config?: Partial<DebugConfig>): void {
  debugConfig = {
    ...debugConfig,
    enabled: true,
    ...config,
  };

  if (debugConfig.enabled) {
    console.log("[Craft Debug] Debug mode enabled", debugConfig);
  }
}

/**
 * Disable debug mode
 *
 * @example
 * ```ts
 * import { disableDebugMode } from "@sylphx/craft";
 *
 * disableDebugMode();
 * ```
 */
export function disableDebugMode(): void {
  debugConfig = { ...defaultDebugConfig };
  console.log("[Craft Debug] Debug mode disabled");
}

/**
 * Get current debug configuration
 */
export function getDebugConfig(): Readonly<DebugConfig> {
  return debugConfig;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return debugConfig.enabled;
}

/**
 * Inspect a draft to see its internal state
 *
 * @param value - The draft or value to inspect
 * @returns Detailed inspection information
 *
 * @example
 * ```ts
 * import { craft, inspectDraft } from "@sylphx/craft";
 *
 * craft(state, (draft) => {
 *   draft.count++;
 *
 *   const inspection = inspectDraft(draft);
 *   console.log(inspection);
 *   // {
 *   //   isDraft: true,
 *   //   isModified: true,
 *   //   type: "object",
 *   //   depth: 0,
 *   //   childDraftCount: 0,
 *   //   ...
 *   // }
 * });
 * ```
 */
export function inspectDraft(value: any): DraftInspection {
  // Check for regular draft
  const state = getState(value);
  if (state) {
    const childDraftCount = state.drafts ? state.drafts.size : 0;

    return {
      isDraft: true,
      isModified: state.modified,
      isFinalized: state.finalized,
      type: Array.isArray(state.base) ? "array" : "object",
      depth: calculateDepth(state),
      childDraftCount,
      changes: [],
    };
  }

  // Check for Map proxy
  const mapState = getMapState(value);
  if (mapState) {
    return {
      isDraft: true,
      isModified: mapState.modified,
      isFinalized: mapState.finalized,
      type: "map",
      depth: calculateDepth(mapState),
      childDraftCount: 0,
      changes: [],
    };
  }

  // Check for Set proxy
  const setState = getSetState(value);
  if (setState) {
    return {
      isDraft: true,
      isModified: setState.modified,
      isFinalized: setState.finalized,
      type: "set",
      depth: calculateDepth(setState),
      childDraftCount: 0,
      changes: [],
    };
  }

  // Not a draft
  return {
    isDraft: false,
    isModified: false,
    isFinalized: false,
    type: "unknown",
    depth: 0,
    childDraftCount: 0,
    changes: [],
  };
}

function calculateDepth(state: any): number {
  let depth = 0;
  let current = state;

  while (current?.parent) {
    depth++;
    current = current.parent;
  }

  return depth;
}

/**
 * Get a human-readable description of a draft's state
 *
 * @param value - The draft to describe
 * @returns Human-readable description
 *
 * @example
 * ```ts
 * import { craft, describeDraft } from "@sylphx/craft";
 *
 * craft(state, (draft) => {
 *   console.log(describeDraft(draft));
 *   // "Draft (object) - Modified: false, Depth: 0"
 *
 *   draft.count++;
 *
 *   console.log(describeDraft(draft));
 *   // "Draft (object) - Modified: true, Depth: 0"
 * });
 * ```
 */
export function describeDraft(value: any): string {
  const inspection = inspectDraft(value);

  if (!inspection.isDraft) {
    return "Not a draft";
  }

  const parts = [
    `Draft (${inspection.type})`,
    `Modified: ${inspection.isModified}`,
    `Depth: ${inspection.depth}`,
  ];

  if (inspection.childDraftCount > 0) {
    parts.push(`Children: ${inspection.childDraftCount}`);
  }

  if (inspection.isFinalized) {
    parts.push("FINALIZED");
  }

  return parts.join(" - ");
}

/**
 * Log the structure of a draft tree
 *
 * @param value - The draft to visualize
 * @param label - Optional label for the output
 *
 * @example
 * ```ts
 * import { craft, visualizeDraft } from "@sylphx/craft";
 *
 * craft(state, (draft) => {
 *   draft.user.name = "Bob";
 *   visualizeDraft(draft, "State after update");
 * });
 * ```
 */
export function visualizeDraft(value: any, label = "Draft"): void {
  const inspection = inspectDraft(value);

  console.group(`📋 ${label}`);
  console.log("Type:", inspection.type);
  console.log("Is Draft:", inspection.isDraft);
  console.log("Modified:", inspection.isModified);
  console.log("Finalized:", inspection.isFinalized);
  console.log("Depth:", inspection.depth);
  console.log("Child Drafts:", inspection.childDraftCount);

  if (inspection.isDraft) {
    const state = getState(value);
    if (state) {
      console.log("Base:", state.base);
      console.log("Copy:", state.copy);

      if (state.drafts && state.drafts.size > 0) {
        console.group("Child Drafts:");
        for (const [key, child] of state.drafts) {
          console.log(`  ${String(key)}:`, describeDraft(child));
        }
        console.groupEnd();
      }
    }
  }

  console.groupEnd();
}

/**
 * Assert that a value is a draft (throws if not)
 * Useful for debugging in producer functions
 *
 * @param value - Value to check
 * @param message - Optional error message
 *
 * @example
 * ```ts
 * import { craft, assertDraft } from "@sylphx/craft";
 *
 * craft(state, (draft) => {
 *   assertDraft(draft); // OK
 *   assertDraft(state); // Throws error!
 * });
 * ```
 */
export function assertDraft(value: any, message?: string): asserts value is any {
  if (!isDraft(value)) {
    throw new Error(
      message || `Expected a draft, but got: ${typeof value}. Are you accessing the original state instead of the draft?`,
    );
  }
}

/**
 * Assert that a value is NOT a draft (throws if it is)
 * Useful for ensuring you're working with immutable values
 *
 * @param value - Value to check
 * @param message - Optional error message
 *
 * @example
 * ```ts
 * import { craft, assertNotDraft } from "@sylphx/craft";
 *
 * const next = craft(state, draft => {
 *   draft.count++;
 * });
 *
 * assertNotDraft(next); // OK - finalized result
 * ```
 */
export function assertNotDraft(value: any, message?: string): void {
  if (isDraft(value)) {
    throw new Error(
      message ||
        "Expected an immutable value, but got a draft. Did you forget to finalize or return from a producer?",
    );
  }
}

/**
 * Get a summary of all drafts in a tree
 *
 * @param value - The draft to analyze
 * @returns Summary with counts
 *
 * @example
 * ```ts
 * import { craft, getDraftTreeSummary } from "@sylphx/craft";
 *
 * craft(state, (draft) => {
 *   draft.users[0].name = "Alice";
 *   draft.users[1].name = "Bob";
 *
 *   const summary = getDraftTreeSummary(draft);
 *   console.log(summary);
 *   // { totalDrafts: 3, modifiedDrafts: 3, maxDepth: 2 }
 * });
 * ```
 */
export function getDraftTreeSummary(value: any): {
  totalDrafts: number;
  modifiedDrafts: number;
  maxDepth: number;
} {
  let totalDrafts = 0;
  let modifiedDrafts = 0;
  let maxDepth = 0;

  function traverse(val: any, depth: number): void {
    const inspection = inspectDraft(val);

    if (inspection.isDraft) {
      totalDrafts++;
      if (inspection.isModified) {
        modifiedDrafts++;
      }
      maxDepth = Math.max(maxDepth, depth);

      // Traverse children
      const state = getState(val);
      if (state?.drafts) {
        for (const child of state.drafts.values()) {
          traverse(child, depth + 1);
        }
      }
    }
  }

  traverse(value, 0);

  return {
    totalDrafts,
    modifiedDrafts,
    maxDepth,
  };
}
