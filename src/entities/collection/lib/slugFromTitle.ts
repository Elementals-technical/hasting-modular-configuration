/**
 * Derive a URL-safe slug from a preset title.
 *
 * Lowercases, collapses any run of non-alphanumeric characters to a single dash,
 * and trims leading/trailing dashes. Disambiguating suffixes are preserved:
 * `'Urban Standard · 42" 1-Drawer'`  -> `urban-standard-42-1-drawer`
 * `'Urban Standard · 42" 1-Drawer_2'` -> `urban-standard-42-1-drawer-2`
 *
 * Uniqueness within a collection is guarded by `collectionCatalog.test.ts`.
 */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
