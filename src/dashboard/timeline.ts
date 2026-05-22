export function buildTimeline(
  unlocked: Record<string, string>,
): Array<{ id: string; unlocked_at: string }> {
  const entries = Object.entries(unlocked).map(([id, unlocked_at]) => ({
    id,
    unlocked_at,
  }));
  entries.sort(
    (a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime(),
  );
  return entries;
}
