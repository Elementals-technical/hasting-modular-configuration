// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useCollectionNavigate } from "../lib/useCollectionNavigate";

/**
 * The collection lives in the URL for the whole session: a client navigation that drops
 * `collectionId` is blocked as identity drift (CollectionReadinessGate).
 */

afterEach(cleanup);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const Navigator = ({ to }: { to: string | { pathname: string; search?: string } }) => {
  const navigate = useCollectionNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go
    </button>
  );
};

const renderAt = (initialPath: string, to: string | { pathname: string; search?: string }) => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/prebuilt/summary" element={<Navigator to={to} />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: "go" }));
  return screen.getByTestId("location").textContent;
};

describe("useCollectionNavigate", () => {
  it("keeps the collection of the session on a plain path", () => {
    expect(renderAt("/prebuilt/summary?collectionId=class", "/prebuilt/model")).toBe(
      "/prebuilt/model?collectionId=class",
    );
  });

  it("keeps it next to the query the target carries", () => {
    expect(renderAt("/prebuilt/summary?collectionId=class", "/prebuilt/countertop?accordion=thickness")).toBe(
      "/prebuilt/countertop?accordion=thickness&collectionId=class",
    );
  });

  it("keeps it when the target is given as an object", () => {
    expect(renderAt("/prebuilt/summary?collectionId=class", { pathname: "/custom/summary", search: "?print=1" })).toBe(
      "/custom/summary?print=1&collectionId=class",
    );
  });

  it("does not invent a collection for a default session", () => {
    expect(renderAt("/prebuilt/summary", "/prebuilt/model")).toBe("/prebuilt/model");
  });

  it("leaves a target that names its own collection alone", () => {
    expect(renderAt("/prebuilt/summary?collectionId=class", "/prebuilt/model?collectionId=mako")).toBe(
      "/prebuilt/model?collectionId=mako",
    );
  });
});
