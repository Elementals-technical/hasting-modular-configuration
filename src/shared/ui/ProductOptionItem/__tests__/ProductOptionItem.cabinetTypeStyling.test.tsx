// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductOptionItem } from "../ProductOptionItem";
import s from "../ProductOptionItem.module.scss";

import type { ProductOptionMetadata } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

afterEach(cleanup);

const renderCabinetTypeItem = (metadata: ProductOptionMetadata, variant: "cabinetType" | "accessory" = "cabinetType") =>
  render(
    <ProductOptionItem
      id="1"
      title="Type"
      name="Some-Type"
      isShortDesc={false}
      variant={variant}
      metadata={metadata}
      onClick={vi.fn()}
    />,
  );

const cardClassName = () => screen.getByText("Type").closest(`.${s.productOption}`)?.className ?? "";

describe("ProductOptionItem cabinet-type card styling comes from the rule's own capability flags", () => {
  it("styles a sink-base type from hasSink, not from its name", () => {
    renderCabinetTypeItem({ hasSink: true, isOpen: false });

    expect(cardClassName()).toContain(s.sinkBaseCabinetTypeItem);
    expect(cardClassName()).not.toContain(s.sideCabinetTypeItem);
  });

  it("styles a closed, sink-less type as a side cabinet even when its name contains 'Sink'", () => {
    // "Sink-Cabinet" is a real cabinet type code whose own hasSink flag is false.
    renderCabinetTypeItem({ hasSink: false, isOpen: false });

    expect(cardClassName()).toContain(s.sideCabinetTypeItem);
    expect(cardClassName()).not.toContain(s.sinkBaseCabinetTypeItem);
  });

  it("styles neither class for an open-shelf type", () => {
    renderCabinetTypeItem({ hasSink: false, isOpen: true });

    expect(cardClassName()).not.toContain(s.sinkBaseCabinetTypeItem);
    expect(cardClassName()).not.toContain(s.sideCabinetTypeItem);
  });

  it("ignores hasSink/isOpen outside the cabinetType variant", () => {
    renderCabinetTypeItem({ hasSink: true, isOpen: false }, "accessory");

    expect(cardClassName()).not.toContain(s.sinkBaseCabinetTypeItem);
    expect(cardClassName()).not.toContain(s.sideCabinetTypeItem);
  });
});
