import type { To } from "react-router-dom";

/**
 * The entry redirect of a flow keeps the whole query of the address it was opened with.
 *
 * A step change carries only the collection, but `/prebuilt` and `/custom` are entry points:
 * their query is what the session was started with. A restore link, for example, also carries
 * `configId` and `hostUrl`, and the page that restores reads them from the URL. Parameters the
 * target names itself win over the ones inherited from the current address.
 */
export const withPreservedEntrySearch = (path: string, currentSearch: string): To => {
  const [pathname, targetSearch = ""] = path.split("?");
  const params = new URLSearchParams(targetSearch);

  for (const [key, value] of new URLSearchParams(currentSearch)) {
    if (!params.has(key)) params.set(key, value);
  }

  const search = params.toString();
  return search ? { pathname, search } : pathname;
};
