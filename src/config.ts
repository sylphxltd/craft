/**
 * Configuration options for Craft
 */

export interface CraftConfig {
  /**
   * Automatically freeze the result
   * @default true
   */
  autoFreeze: boolean;

  /**
   * Use strict shallow copy (copy all properties including non-enumerable)
   * @default false
   */
  useStrictShallowCopy: boolean;

  /**
   * Custom shallow copy function for advanced use cases
   * Allows users to provide custom cloning logic for special types
   * @default undefined
   */
  customShallowCopy?: (value: any, defaultCopy: (v: any) => any) => any;
}

const defaultConfig: CraftConfig = {
  autoFreeze: true,
  useStrictShallowCopy: false,
};

let config: CraftConfig = { ...defaultConfig };

/**
 * Get current configuration
 */
export function getConfig(): Readonly<CraftConfig> {
  return config;
}

/**
 * Set auto-freeze option
 *
 * @param enabled - Whether to automatically freeze results
 *
 * @example
 * ```ts
 * import { setAutoFreeze } from "@sylphx/craft";
 *
 * // Disable auto-freeze for performance in production
 * setAutoFreeze(false);
 * ```
 */
export function setAutoFreeze(enabled: boolean): void {
  config.autoFreeze = enabled;
}

/**
 * Set strict shallow copy option
 *
 * @param enabled - Whether to use strict shallow copy
 *
 * @example
 * ```ts
 * import { setUseStrictShallowCopy } from "@sylphx/craft";
 *
 * // Enable strict shallow copy
 * setUseStrictShallowCopy(true);
 * ```
 */
export function setUseStrictShallowCopy(enabled: boolean): void {
  config.useStrictShallowCopy = enabled;
}

/**
 * Set custom shallow copy function
 *
 * @param fn - Custom shallow copy function that receives the value and default copy function
 *
 * @example
 * ```ts
 * import { setCustomShallowCopy } from "@sylphx/craft";
 *
 * // Custom cloning for special class instances
 * setCustomShallowCopy((value, defaultCopy) => {
 *   if (value instanceof MyClass) {
 *     return value.clone();
 *   }
 *   return defaultCopy(value);
 * });
 * ```
 */
export function setCustomShallowCopy(
  fn: ((value: any, defaultCopy: (v: any) => any) => any) | undefined,
): void {
  config.customShallowCopy = fn;
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  config = { ...defaultConfig };
}
