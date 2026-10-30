import { createContext, useContext } from "react";

import { interpolateMessage, type MessageParams } from "./interpolate";
import { UI_REASON_TEXTS } from "./uiReasonTexts";

/**
 * One place that turns a reason code into the text the user reads (DEV-08).
 *
 * A rule returns a stable code; the interface resolves it. Components never hold a phrase of
 * their own: they name the code and, while a caller still passes the old text, hand that over
 * as the fallback.
 */

export type Reason = {
  /** Stable reason code, e.g. "countertop.maxCompatibleWidth". */
  code?: string;
  params?: MessageParams;
  /** Text a caller resolved itself; used when the code has no text anywhere. */
  text?: string;
};

export type ReasonTextResolver = (reason: Reason) => string | undefined;

/**
 * Without a provider only the interface dictionary is known, so a component shows the same
 * text in a test or a storybook as in the app for every code no collection overrides.
 */
export const resolveUiReasonText: ReasonTextResolver = ({ code, params, text }) => {
  const template = code ? UI_REASON_TEXTS[code] : undefined;
  if (template) return interpolateMessage(template, params);

  return text ?? code;
};

const ReasonTextContext = createContext<ReasonTextResolver>(resolveUiReasonText);

export const ReasonTextContextProvider = ReasonTextContext.Provider;

/** Resolver of the active collection when a provider is mounted, the dictionary otherwise. */
export const useReasonText = (): ReasonTextResolver => useContext(ReasonTextContext);
