// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";

import { BottomStickyBar } from "../ui/BottomStickyBar";

afterEach(cleanup);

describe("BottomStickyBar Next/Back against a non-USH schema", () => {
  it("labels Next with the schema's own next step and hides Back on the first step", () => {
    renderWithFixtureCollection(<BottomStickyBar flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    expect(screen.getByText("Next: Test Finish")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Back to/ })).toBeNull();
  });

  it("navigates to the schema's next step path when Next is clicked", async () => {
    renderWithFixtureCollection(<BottomStickyBar flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    fireEvent.click(screen.getByText("Next: Test Finish"));

    await waitFor(() => expect(screen.getAllByText("How to Buy").length).toBeGreaterThan(0));
  });

  it("labels Back with the schema's own previous step on the last step", () => {
    renderWithFixtureCollection(<BottomStickyBar flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    expect(screen.getByRole("button", { name: "Back to Fixture Models" })).toBeTruthy();
    expect(screen.getAllByText("How to Buy").length).toBeGreaterThan(0);
  });

  it("navigates to the schema's previous step path when Back is clicked", async () => {
    renderWithFixtureCollection(<BottomStickyBar flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to Fixture Models" }));

    await waitFor(() => expect(screen.getByText("Next: Test Finish")).toBeTruthy());
  });
});
