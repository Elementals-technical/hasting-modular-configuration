// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HubspotForm from "../HubspotForm";

type HubspotCreateConfig = {
  target: string;
  onFormReady?: () => void;
  onFormSubmit?: () => void;
};

const renderHubspotFields = (config: HubspotCreateConfig) => {
  const target = document.querySelector(config.target);
  const form = document.createElement("form");
  const configurationId = document.createElement("input");
  const configurationUrl = document.createElement("input");

  configurationId.name = "configuration-id";
  configurationUrl.name = "configuration-url";

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
          "configuration-id": "config-123",
          "configuration-url": "https://example.test/config?configId=config-123",
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });

    expect(createFormCalls).toBe(1);
    expect(document.querySelector<HTMLInputElement>('[name="configuration-id"]')?.value).toBe("config-123");
    expect(document.querySelector<HTMLInputElement>('[name="configuration-url"]')?.value).toBe(
      "https://example.test/config?configId=config-123",
    );
  });

  it("keeps hidden fields current when values change before submit", async () => {
    const { rerender } = render(
      <HubspotForm
        portalId="21569224"
        formId="form-id"
        hiddenFields={{
          "configuration-id": "config-123",
          "configuration-url": "https://example.test/config?configId=config-123",
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
          "configuration-id": "config-456",
          "configuration-url": "https://example.test/config?configId=config-456",
        }}
      />,
    );

    const configurationId = document.querySelector<HTMLInputElement>('[name="configuration-id"]');
    const configurationUrl = document.querySelector<HTMLInputElement>('[name="configuration-url"]');

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
});
