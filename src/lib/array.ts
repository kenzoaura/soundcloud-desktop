// Return a new array with the element at `from` moved to index `to`. Out-of-range
// or equal indices yield an unchanged copy. Used for optimistic drag-reorder.
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const n = arr.length
  const copy = arr.slice()
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return copy
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}
