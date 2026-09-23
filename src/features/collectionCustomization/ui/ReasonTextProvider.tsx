import { useMemo, type ReactNode } from "react";

import { getActiveProductProfile } from "@/entities/configuration";
import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  interpolateMessage,
  ReasonTextContextProvider,
  resolveUiReasonText,
  type ReasonTextResolver,
} from "@/shared/lib/reasonText";

/**
 * Resolves the reason codes of the interface against the active collection (DEV-08).
 *
 * Order: the collection's own text for the code, then the interface dictionary, then the text a
 * caller resolved itself, then the bare code. So a collection can word any reason its own way,
 * and one it says nothing about still reads as an ordinary sentence.
 */
export const ReasonTextProvider = ({ children }: { children: ReactNode }) => {
  const profile = useAppSelector(getActiveProductProfile);

  const resolve = useMemo<ReasonTextResolver>(() => {
    const messages = profile?.messages;

    return (reason) => {
      const template = reason.code ? messages?.[reason.code] : undefined;
      return template ? interpolateMessage(template, reason.params) : resolveUiReasonText(reason);
    };
  }, [profile]);

  return <ReasonTextContextProvider value={resolve}>{children}</ReasonTextContextProvider>;
};
