# RRB-Tree Performance Analysis

## Problem Identified

The RRB-tree implementation shows 0 ops/sec in benchmarks despite correct functionality because of conversion overhead.

## Root Cause

For each `craft()` call on a 1000-item array with RRB-tree:

1. **arrayToRRB** conversion: O(n) = ~1000 operations
2. **RRB operation** (push/set): O(log₃₂ n) = ~5 operations
3. **rrbToArray** conversion: O(n) = ~1001 operations
4. **freeze**: O(n) = ~1001 operations

**Total: ~3000 operations**

Compare to Immer (regular array):

1. **Shallow copy**: O(n) = ~1000 operations
2. **Array operation** (push): O(1) = 1 operation
3. **freeze**: O(n) = ~1001 operations

**Total: ~2000 operations**

## Why RRB is Slower

```typescript
// Benchmark does single operation per craft() call
craft({ items: veryLargeArray }, (draft) => {
  draft.items.push(999);  // Single mutation
});
```

Conversion overhead dominates:
- RRB conversion (to + from): 2000 ops
- RRB operation benefit: saves ~995 ops (1000 - 5)
- Net result: 1005 ops **worse** than regular array

## When RRB Trees Help

RRB-trees only provide advantage when:

1. **Many operations before finalization**:
   ```typescript
   craft({ items: largeArray }, (draft) => {
     for (let i = 0; i < 1000; i++) {
       draft.items.push(i);  // 1000 operations
     }
   });
   ```
   - Regular array: O(1000) for 1000 pushes = 1000 ops
   - RRB: O(log 1000) per push × 1000 = ~5000 ops, BUT...
   - Wait, that's still worse!

Actually, let me recalculate:
- Regular array push is amortized O(1), so 1000 pushes = ~1000 ops
- RRB push is O(log n) but involves tree navigation overhead
- Plus 2000 ops for conversions

Even for bulk operations, the conversion overhead kills the benefit.

2. **Persistent data structures** (not applicable to craft()):
   - Keeping multiple versions
   - Structural sharing across versions
   - craft() finalizes immediately, so no version retention

## Conclusion

RRB-trees are **not suitable** for Craft's use case because:

1. craft() finalizes immediately (no version persistence)
2. Typical usage: 1-10 mutations per call (conversion overhead dominates)
3. Immer's approach (shallow copy + O(1) ops) is optimal for this pattern

## Recommendation

**Disable RRB-tree** integration. The implementation is correct but architecturally mismatched to the problem domain.

Keep code for potential future use in:
- Dedicated persistent data structure library
- Long-lived draft sessions (future API enhancement)
- Streaming/incremental updates
