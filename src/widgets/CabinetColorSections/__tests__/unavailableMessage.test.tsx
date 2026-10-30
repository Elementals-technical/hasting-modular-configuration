// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { ReasonTextProvider } from "@/features/collectionCustomization";
import { grainDirectionRule } from "@/features/configurator-rule-core/options/rules/grainDirectionRule";

import { UnavailableMessage } from "../ui/UnavailableMessage";

/**
 * DEV-08: a rule returns a code and the interface resolves it against the collection. The rule
 * must hand the values of the text over too — the resolver prefers the collection's template
 * over the text the rule already built, so without them the user reads the bare placeholder.
 */

afterEach(cleanup);

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(setActiveProfile(ushProfile));
});

const renderReason = (reason: {
  reason?: string;
  reasonCode?: string;
  reasonParams?: Record<string, string | number>;
}) =>
  render(
    <Provider store={store}>
      <ReasonTextProvider>
        <UnavailableMessage {...reason} />
      </ReasonTextProvider>
    </Provider>,
  );

describe("the reason a field cannot be used", () => {
  it("names the materials the grain rule listed, not the placeholder", () => {
    const result = grainDirectionRule({ material: "Lacquer Matte", finish: "TKF" }, ushProfile);

    renderReason({ reason: result.reason, reasonCode: result.reasonCode, reasonParams: result.reasonParams });

    expect(screen.getByText("Grain direction is available only for Essenze, HPL, and 3D materials.")).toBeTruthy();
    expect(screen.queryByText(/\{materials\}/)).toBeNull();
  });

  it("shows the code's text with its placeholders when the values are lost", () => {
    const result = grainDirectionRule({ material: "Lacquer Matte", finish: "TKF" }, ushProfile);

    renderReason({ reason: result.reason, reasonCode: result.reasonCode });

    expect(screen.getByText(/\{materials\}/)).toBeTruthy();
  });
});
