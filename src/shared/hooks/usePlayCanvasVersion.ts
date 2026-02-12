import { useEffect, useState } from "react";

/**
 * Reads the PlayCanvas cache-bust version from the generated
 * `/playcanvas-version.json` file (created by `npm run update-playcanvas`).
 *
 * Falls back to the current Unix timestamp so that even without
 * running the script, the iframe always gets a fresh load.
 */
export function usePlayCanvasVersion(): string {
  const [version, setVersion] = useState(() => Date.now().toString(36));

  useEffect(() => {
    fetch("/playcanvas-version.json")
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        if (data?.version) setVersion(data.version);
      })
      .catch(() => {
        // File doesn't exist yet — keep the timestamp fallback
      });
  }, []);

  return version;
}
