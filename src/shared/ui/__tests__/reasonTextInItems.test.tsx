// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ReasonTextContextProvider, type ReasonTextResolver } from "@/shared/lib/reasonText";

import { ProductOptionItem } from "../ProductOptionItem/ProductOptionItem";
import { ProductStyleItem } from "../ProductStyleItem/ProductStyleItem";

/**
 * DEV-08: the items hold no wording of their own. They name a reason code, the interface
 * resolves it: the collection's text where it has one, the interface dictionary otherwise.
 */

/** Stands in for the collection: only these codes have a text of their own. */
const collectionTexts: Record<string, string> = {
  "ui.optionUnavailable": "Nicht verfügbar",
  "drawers.mixingRestricted": "Diese Fronten passen nicht zusammen.",
  "countertop.maxCompatibleWidth": "Zu breit: höchstens {maxCm} cm.",
};

const collectionResolver: ReasonTextResolver = ({ code, params, text }) => {
  const template = code ? collectionTexts[code] : undefined;
  if (!template) return text ?? code;
  return params ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name])) : template;
};

const withCollection = (children: ReactNode) => (
  <ReasonTextContextProvider value={collectionResolver}>{children}</ReasonTextContextProvider>
);

afterEach(cleanup);

const hoverHint = (label: string) => {
  fireEvent.mouseEnter(screen.getByText(label).closest("div") as HTMLElement);
};

describe("a disabled option", () => {
  it("shows the interface wording when the collection says nothing", () => {
    render(<ProductOptionItem id={1} title="Matte White" isAvailable={false} isShortDesc={false} />);
    hoverHint("Matte White");

    expect(screen.getByText("Not available for selected configuration")).toBeTruthy();
  });

  it("shows the collection's wording for the same code", () => {
    render(withCollection(<ProductOptionItem id={1} title="Matte White" isAvailable={false} isShortDesc={false} />));
    hoverHint("Matte White");

    expect(screen.getByText("Nicht verfügbar")).toBeTruthy();
  });

  it("shows the reason its rule named, with the rule's values in it", () => {
    render(
      withCollection(
        <ProductOptionItem
          id={1}
          title="Matte White"
          isAvailable={false}
          isShortDesc={false}
          disabledReason="Not available for current configuration width, maximum compatibility size 160 cm."
          disabledReasonCode="countertop.maxCompatibleWidth"
          disabledReasonParams={{ maxCm: 160 }}
        />,
      ),
    );
    hoverHint("Matte White");

    expect(screen.getByText("Zu breit: höchstens 160 cm.")).toBeTruthy();
  });

  it("falls back to the text the rule resolved while no one knows its code", () => {
    render(
      <ProductOptionItem
        id={1}
        title="Matte White"
        isAvailable={false}
        isShortDesc={false}
        disabledReason="Not available for current cabinet depth"
        disabledReasonCode="countertop.materialNotAvailableForDepth"
      />,
    );
    hoverHint("Matte White");

    expect(screen.getByText("Not available for current cabinet depth")).toBeTruthy();
  });
});

describe("a cabinet style the collection does not mix", () => {
  const renderStyle = (children: ReactNode) => render(<MemoryRouter>{children}</MemoryRouter>);

  it("explains it in the interface wording", () => {
    renderStyle(<ProductStyleItem value="2" title="2 Drawer" isMixingRestricted handleOpenStyleSidebar={() => {}} />);
    hoverHint("2 Drawer");

    expect(screen.getByText("These cabinet styles cannot be mixed in one vanity configuration.")).toBeTruthy();
  });

  it("explains it in the collection's wording when it has one", () => {
    renderStyle(
      withCollection(
        <ProductStyleItem value="1" title="1 Drawer" isMixingRestricted handleOpenStyleSidebar={() => {}} />,
      ),
    );
    hoverHint("1 Drawer");

    expect(screen.getByText("Diese Fronten passen nicht zusammen.")).toBeTruthy();
  });
});
