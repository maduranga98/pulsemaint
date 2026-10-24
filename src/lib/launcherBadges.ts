/**
 * Red count tags on the phone launcher. Each tile gets the number of unread
 * notifications and "needs attention" alerts (the same ones the bell lists)
 * whose link points inside that module, so the tile and the bell never disagree.
 */

/** Path without query string or hash: "/app/work-orders?woId=1" → "/app/work-orders". */
export function pathOnly(link: string): string {
  return link.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
}

/**
 * The tile a link belongs to: the module whose path is the longest prefix of the link
 * ("/app/requests/inbox" → Requests Inbox, not Requests). A link that points at a module's
 * parent ("/app/inventory") falls back to the first module underneath it.
 */
export function tileForLink(link: string, tilePaths: readonly string[]): string | null {
  const path = pathOnly(link);
  let best: string | null = null;
  for (const to of tilePaths) {
    if ((path === to || path.startsWith(`${to}/`)) && (best === null || to.length > best.length)) best = to;
  }
  if (best) return best;
  return tilePaths.find((to) => to.startsWith(`${path}/`)) ?? null;
}

/** Counts per tile path. Entries without a link, or pointing outside every tile, are ignored. */
export function launcherBadgeCounts(
  entries: ReadonlyArray<{ linkTo: string | null | undefined }>,
  tilePaths: readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (!e.linkTo) continue;
    const tile = tileForLink(e.linkTo, tilePaths);
    if (tile) counts[tile] = (counts[tile] ?? 0) + 1;
  }
  return counts;
}

/** "9+" once a count passes nine, so a tag never outgrows its tile. */
export function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count);
}
