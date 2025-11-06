/**
 * Type utilities for Craft
 */

export type Draft<T> = T extends Map<infer K, infer V>
  ? Map<K, V>
  : T extends Set<infer V>
    ? Set<V>
    : T extends object
      ? {
          -readonly [K in keyof T]: Draft<T[K]>;
        }
      : T;

export type Producer<T> = (draft: Draft<T>) => T | void;

export type Composer<T> = {
  with: (producer: Producer<T>) => Composer<T>;
  produce: (base: T) => T;
};

export type Primitive = string | number | boolean | null | undefined | symbol | bigint;

export type Immutable<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<Immutable<U>>
    : T extends Map<infer K, infer V>
      ? ReadonlyMap<Immutable<K>, Immutable<V>>
      : T extends Set<infer V>
        ? ReadonlySet<Immutable<V>>
        : {
            readonly [K in keyof T]: Immutable<T[K]>;
          };
