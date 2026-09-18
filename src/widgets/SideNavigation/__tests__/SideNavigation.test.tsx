// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";

import { SideNavigation } from "../ui/SideNavigation";

afterEach(cleanup);

const renderAt = (initialPath: string) =>
  renderWithFixtureCollection(<SideNavigation />, { collectionId: "fixture-ui", initialPath });

describe("SideNavigation against a non-USH schema", () => {
  it("renders fixture-ui's own prebuilt steps, in schema order", () => {
    renderAt("/fixture/models?collectionId=fixture-ui");

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Fixture Models", "Test Finish"]);
  });

  it("renders fixture-ui's own custom step once the path belongs to the custom flow", () => {
    renderAt("/fixture/builder?collectionId=fixture-ui");

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Fixture Builder"]);
    expect(screen.getByText("Custom")).toBeTruthy();
  });

  it("marks the link matching the current URL as active", () => {
    renderAt("/fixture/finish?collectionId=fixture-ui");

    const activeLink = screen.getByRole("link", { name: "Test Finish" });
    const inactiveLink = screen.getByRole("link", { name: "Fixture Models" });
    expect(activeLink.className).toMatch(/active/);
    expect(inactiveLink.className).not.toMatch(/active/);
  });

  it("preserves collectionId in every step link's href", () => {
    renderAt("/fixture/models?collectionId=fixture-ui");

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/fixture/models?collectionId=fixture-ui",
      "/fixture/finish?collectionId=fixture-ui",
    ]);
  });
});
