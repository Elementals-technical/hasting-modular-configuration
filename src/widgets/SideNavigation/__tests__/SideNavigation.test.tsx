// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";

import { SideNavigation } from "../ui/SideNavigation";

afterEach(cleanup);

describe("SideNavigation against a non-USH schema", () => {
  it("renders fixture-ui's own prebuilt steps, in schema order", () => {
    renderWithFixtureCollection(<SideNavigation flow="prebuilt" />, { collectionId: "fixture-ui" });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Fixture Models", "Test Finish"]);
  });

  it("renders fixture-ui's own custom step", () => {
    renderWithFixtureCollection(<SideNavigation flow="custom" />, { collectionId: "fixture-ui" });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Fixture Builder"]);
  });

  it("marks the link matching the current URL as active", () => {
    renderWithFixtureCollection(<SideNavigation flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    const activeLink = screen.getByRole("link", { name: "Test Finish" });
    const inactiveLink = screen.getByRole("link", { name: "Fixture Models" });
    expect(activeLink.className).toMatch(/active/);
    expect(inactiveLink.className).not.toMatch(/active/);
  });

  it("preserves collectionId in every step link's href", () => {
    renderWithFixtureCollection(<SideNavigation flow="prebuilt" />, { collectionId: "fixture-ui" });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/fixture/models?collectionId=fixture-ui",
      "/fixture/finish?collectionId=fixture-ui",
    ]);
  });
});
