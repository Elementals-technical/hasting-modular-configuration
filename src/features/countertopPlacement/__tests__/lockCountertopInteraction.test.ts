// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { lockCountertopInteraction } from "../lib/lockCountertopInteraction";

afterEach(() => document.body.replaceChildren());

describe("countertop preview interaction ownership", () => {
  it("locks sidebar, quote, navigation and new portals without disabling the editor/canvas, then restores original inert state", async () => {
    document.body.innerHTML = `<main><nav></nav><div id="player"><div id="host"><iframe></iframe><section aria-label="Cabinet placement test controls"></section><section aria-label="Countertop positioning"><button>Apply</button></section></div><button id="save">Save</button></div><aside inert="original"><button>Quote</button></aside></main>`;
    const host = document.getElementById("host")!;
    const unlock = lockCountertopInteraction(host);
    expect(host.hasAttribute("inert")).toBe(false);
    expect(host.querySelector("iframe")!.hasAttribute("inert")).toBe(false);
    expect(host.querySelector('[aria-label="Countertop positioning"]')!.hasAttribute("inert")).toBe(false);
    expect(host.querySelector('[aria-label="Cabinet placement test controls"]')!.hasAttribute("inert")).toBe(true);
    expect(document.querySelector("nav")!.hasAttribute("inert")).toBe(true);
    expect(document.getElementById("save")!.hasAttribute("inert")).toBe(true);
    const portal = document.createElement("div");
    document.body.append(portal);
    await Promise.resolve();
    expect(portal.hasAttribute("inert")).toBe(true);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    unlock();
    expect(document.querySelector("aside")!.getAttribute("inert")).toBe("original");
    expect(document.querySelector("nav")!.hasAttribute("inert")).toBe(false);
    expect(document.getElementById("save")!.hasAttribute("inert")).toBe(false);
    expect(portal.hasAttribute("inert")).toBe(false);
  });
});
