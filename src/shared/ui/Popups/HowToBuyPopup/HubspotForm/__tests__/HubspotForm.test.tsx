// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HubspotForm, { type HubspotSubmissionValues } from "../HubspotForm";

type HubspotCreateConfig = {
  target: string;
  onFormReady?: () => void;
  onFormSubmit?: () => void;
  onFormSubmitted?: (...args: unknown[]) => void;
};

const renderHubspotFields = (config: HubspotCreateConfig) => {
  const target = document.querySelector(config.target);
  const form = document.createElement("form");
  const configurationId = document.createElement("input");
  const configurationUrl = document.createElement("input");

  configurationId.name = "configuration_id";
  configurationUrl.name = "configuration_url";

  form.append(configurationId, configurationUrl);
  target?.append(form);
  config.onFormReady?.();
};

describe("HubspotForm", () => {
  let createFormCalls: number;
  let createdConfig: HubspotCreateConfig | null;

  beforeEach(() => {
    vi.useFakeTimers();
    createFormCalls = 0;
    createdConfig = null;
    window.hbspt = {
      forms: {
        create: (config) => {
          createFormCalls += 1;
          createdConfig = config;
          renderHubspotFields(config);
        },
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete window.hbspt;
  });

  it("writes configuration hidden fields when the HubSpot form is ready", async () => {
    render(
      <HubspotForm
        portalId="21569224"
        formId="form-id"
        hiddenFields={{
          configuration_id: "config-123",
          configuration_url: "https://example.test/config?configId=config-123",
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });

    expect(createFormCalls).toBe(1);
    expect(document.querySelector<HTMLInputElement>('[name="configuration_id"]')?.value).toBe("config-123");
    expect(document.querySelector<HTMLInputElement>('[name="configuration_url"]')?.value).toBe(
      "https://example.test/config?configId=config-123",
    );
  });

  it("keeps hidden fields current when values change before submit", async () => {
    const { rerender } = render(
      <HubspotForm
        portalId="21569224"
        formId="form-id"
        hiddenFields={{
          configuration_id: "config-123",
          configuration_url: "https://example.test/config?configId=config-123",
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });

    rerender(
      <HubspotForm
        portalId="21569224"
        formId="form-id"
        hiddenFields={{
          configuration_id: "config-456",
          configuration_url: "https://example.test/config?configId=config-456",
        }}
      />,
    );

    const configurationId = document.querySelector<HTMLInputElement>('[name="configuration_id"]');
    const configurationUrl = document.querySelector<HTMLInputElement>('[name="configuration_url"]');

    expect(configurationId?.value).toBe("config-456");
    expect(configurationUrl?.value).toBe("https://example.test/config?configId=config-456");

    if (configurationId) configurationId.value = "";
    if (configurationUrl) configurationUrl.value = "";

    act(() => {
      createdConfig?.onFormSubmit?.();
    });

    expect(configurationId?.value).toBe("config-456");
    expect(configurationUrl?.value).toBe("https://example.test/config?configId=config-456");
  });

  const renderReadyForm = async (onFormSubmitted: (submissionValues: HubspotSubmissionValues) => void) => {
    render(<HubspotForm portalId="21569224" formId="form-id" onFormSubmitted={onFormSubmitted} />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });
  };

  // jsdom delivers window.postMessage through a timer, and this suite fakes timers.
  const dispatchHubspotMessage = (data: unknown) => {
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data }));
    });
  };

  it("passes the submitted string values from the embed callback", async () => {
    const onFormSubmitted = vi.fn();
    await renderReadyForm(onFormSubmitted);

    act(() => {
      createdConfig?.onFormSubmitted?.(document.querySelector("form"), {
        redirectUrl: "",
        submissionValues: { firstname: "Test", email: "qa@example.com", tags: ["a"], count: 1 },
      });
    });

    expect(onFormSubmitted.mock.calls).toStrictEqual([[{ firstname: "Test", email: "qa@example.com" }]]);
  });

  it("passes the submitted values from the hsFormCallback message", async () => {
    const onFormSubmitted = vi.fn();
    await renderReadyForm(onFormSubmitted);

    dispatchHubspotMessage({
      type: "hsFormCallback",
      eventName: "onFormSubmitted",
      id: "form-id",
      data: { redirectUrl: "", submissionValues: { lastname: "Buyer", phone: "+1 555 0100" } },
    });

    expect(onFormSubmitted.mock.calls).toStrictEqual([[{ lastname: "Buyer", phone: "+1 555 0100" }]]);
  });

  it("reports one submission when both the embed callback and the message arrive", async () => {
    const onFormSubmitted = vi.fn();
    await renderReadyForm(onFormSubmitted);

    act(() => {
      createdConfig?.onFormSubmitted?.(document.querySelector("form"), {
        submissionValues: { email: "qa@example.com" },
      });
    });
    dispatchHubspotMessage({
      type: "hsFormCallback",
      eventName: "onFormSubmitted",
      id: "form-id",
      data: { submissionValues: { email: "qa@example.com" } },
    });

    expect(onFormSubmitted).toHaveBeenCalledTimes(1);
  });

  it("ignores another form's message and reports no values when HubSpot sends none", async () => {
    const onFormSubmitted = vi.fn();
    await renderReadyForm(onFormSubmitted);

    dispatchHubspotMessage({ type: "hsFormCallback", eventName: "onFormSubmitted", id: "other-form", data: {} });
    expect(onFormSubmitted).not.toHaveBeenCalled();

    dispatchHubspotMessage({ type: "hsFormCallback", eventName: "onFormSubmitted", id: "form-id" });
    expect(onFormSubmitted.mock.calls).toStrictEqual([[{}]]);
  });
});
