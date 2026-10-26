import type { HubspotSubmissionValues } from "@/shared/ui/Popups/HowToBuyPopup/HubspotForm/HubspotForm";

import type { ModularConfiguratorFlow } from "./modularKeyEvents";

// Messages the client's GTM listener picks up on the parent page (by `source`) and routes to Meta.
// Contract: docs/parent-configurator-integration.md, "postMessage events".
export const PARENT_PAGE_EVENT_SOURCE = "hastings_configurator";
// The production line configures a single product line.
export const PARENT_PAGE_EVENT_PRODUCT = "urban_standard_height";

export const PARENT_PAGE_EVENT_NAMES = {
  nextClick: "configurator_next_click",
  quoteDownload: "configurator_quote_download",
  howToBuySubmit: "configurator_how_to_buy_submit",
} as const;

// The How to Buy submit message carries contact details, so it is posted only to these exact parent origins.
export const HOW_TO_BUY_SUBMIT_ALLOWED_PARENT_ORIGINS: readonly string[] = [
  "https://hastingsbathcollection.com",
  "https://www.hastingsbathcollection.com",
  "https://info.hastingsbathcollection.com",
];

type ParentPageEventName = (typeof PARENT_PAGE_EVENT_NAMES)[keyof typeof PARENT_PAGE_EVENT_NAMES];
type ParentPageFlow = "prebuilt" | "create_your_own";

type ParentPageEventBase = {
  source: typeof PARENT_PAGE_EVENT_SOURCE;
  event_id: string;
  flow: ParentPageFlow;
  product: typeof PARENT_PAGE_EVENT_PRODUCT;
};

export type ConfiguratorNextClickEvent = ParentPageEventBase & {
  event: typeof PARENT_PAGE_EVENT_NAMES.nextClick;
  step: number;
};

export type ConfiguratorQuoteDownloadEvent = ParentPageEventBase & {
  event: typeof PARENT_PAGE_EVENT_NAMES.quoteDownload;
};

type HowToBuyContact = {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
};

export type ConfiguratorHowToBuySubmitEvent = ParentPageEventBase &
  HowToBuyContact & {
    event: typeof PARENT_PAGE_EVENT_NAMES.howToBuySubmit;
  };

type ParentPageEvent = ConfiguratorNextClickEvent | ConfiguratorQuoteDownloadEvent | ConfiguratorHowToBuySubmitEvent;

// Message key → internal field name in the How to Buy HubSpot form.
const HOW_TO_BUY_CONTACT_FIELDS: ReadonlyArray<[keyof HowToBuyContact, string]> = [
  ["email", "email"],
  ["phone", "phone"],
  ["first_name", "firstname"],
  ["last_name", "lastname"],
];

const EVENT_ID_SUFFIX_LENGTH = 5;

const createEventId = () => {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(EVENT_ID_SUFFIX_LENGTH)), (byte) =>
    (byte % 36).toString(36),
  ).join("");

  return `hb_${Date.now()}_${suffix}`;
};

const createEventBase = <TEvent extends ParentPageEventName>(
  event: TEvent,
  flow: ModularConfiguratorFlow | undefined,
): ParentPageEventBase & { event: TEvent } => ({
  source: PARENT_PAGE_EVENT_SOURCE,
  event,
  event_id: createEventId(),
  flow: flow === "custom" ? "create_your_own" : "prebuilt",
  product: PARENT_PAGE_EVENT_PRODUCT,
});

const toOrigin = (value: string | null) => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const resolveHowToBuySubmitTargetOrigin = (candidates: {
  ancestorOrigin: string | null;
  referrer: string;
  hostUrl: string | null;
}): string | null => {
  const origins = [candidates.ancestorOrigin, candidates.referrer, candidates.hostUrl].map(toOrigin);

  // The browser drops a message whose target is not the real parent origin, so any allowed candidate is safe.
  return origins.find((origin) => origin !== null && HOW_TO_BUY_SUBMIT_ALLOWED_PARENT_ORIGINS.includes(origin)) ?? null;
};

const readParentAncestorOrigin = () => {
  // lib.dom types it as always present, but Firefox before 148 and jsdom do not implement it.
  const ancestorOrigins: DOMStringList | undefined = window.location.ancestorOrigins;
  return ancestorOrigins?.length ? ancestorOrigins.item(0) : null;
};

const isEmbeddedInParentPage = () => typeof window !== "undefined" && window.parent !== window;

const postToParentPage = (message: ParentPageEvent, targetOrigin: string) => {
  try {
    window.parent.postMessage(message, targetOrigin);
  } catch (error) {
    console.warn(`[ParentPageEvents] Failed to post ${message.event}`, error);
  }
};

const pickHowToBuyContact = (submissionValues: HubspotSubmissionValues) => {
  const contact: HowToBuyContact = {};

  HOW_TO_BUY_CONTACT_FIELDS.forEach(([key, fieldName]) => {
    const value = submissionValues[fieldName]?.trim();
    if (value) contact[key] = value;
  });

  return contact;
};

export const trackConfiguratorNextClick = ({
  flow,
  step,
}: {
  flow: ModularConfiguratorFlow | undefined;
  step: number;
}) => {
  if (!isEmbeddedInParentPage()) return;

  const message: ConfiguratorNextClickEvent = {
    ...createEventBase(PARENT_PAGE_EVENT_NAMES.nextClick, flow),
    step,
  };

  postToParentPage(message, "*");
};

export const trackConfiguratorQuoteDownload = ({ flow }: { flow: ModularConfiguratorFlow | undefined }) => {
  if (!isEmbeddedInParentPage()) return;

  const message: ConfiguratorQuoteDownloadEvent = createEventBase(PARENT_PAGE_EVENT_NAMES.quoteDownload, flow);

  postToParentPage(message, "*");
};

export const trackConfiguratorHowToBuySubmit = ({
  flow,
  submissionValues,
  hostUrl,
}: {
  flow: ModularConfiguratorFlow | undefined;
  submissionValues: HubspotSubmissionValues;
  hostUrl: string | null;
}) => {
  if (!isEmbeddedInParentPage()) return;

  const ancestorOrigin = readParentAncestorOrigin();
  const targetOrigin = resolveHowToBuySubmitTargetOrigin({ ancestorOrigin, referrer: document.referrer, hostUrl });

  if (!targetOrigin) {
    console.warn(
      `[ParentPageEvents] ${PARENT_PAGE_EVENT_NAMES.howToBuySubmit} was not sent: parent origin not allowed`,
      {
        ancestorOrigin,
        referrerOrigin: toOrigin(document.referrer),
        hostUrlOrigin: toOrigin(hostUrl),
      },
    );
    return;
  }

  const message: ConfiguratorHowToBuySubmitEvent = {
    ...createEventBase(PARENT_PAGE_EVENT_NAMES.howToBuySubmit, flow),
    ...pickHowToBuyContact(submissionValues),
  };

  postToParentPage(message, targetOrigin);
};
