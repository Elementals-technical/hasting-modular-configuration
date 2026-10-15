import { useCallback, useState } from "react";

import type { AttributeValue } from "@/entities/configuration";
import { useHistoryStep } from "@/entities/history/lib/useHistoryStep";

import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import type { ChangePreview, ChangeResult } from "../model/types";
import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

/**
 * The selection handler C hands to a field (EXECUTION §1: C06 -> B06).
 *
 * A field passes the picked value to `onChange`; the handler addresses it at the scope the
 * profile declares and runs it through the command service. A history step is taken only
 * for a change that is about to be applied, so a preview the user cancels leaves no empty
 * undo step, and is written only once the change moved the configuration, so picking the
 * value already chosen leaves none either. A change that needs approval comes back as
 * `preview` for the field's dialog (`onConfirm` / `onCancel`); a change the rules refuse
 * comes back as `notice`.
 */
export const useAttributeChangeHandler = (attributeId: string, { runtime }: UseChangeAttributeOptions = {}) => {
  const { change, confirm, evaluate, getState } = useChangeAttribute({ runtime });
  const { run: runStep } = useHistoryStep();
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showResult = useCallback((result: ChangeResult): ChangeResult => {
    setPreview(result.status === "confirmation-required" ? result.preview : null);
    setNotice(result.status === "blocked" ? result.reason : null);
    return result;
  }, []);

  const onChange = useCallback(
    async (value: AttributeValue): Promise<ChangeResult> => {
      const request = resolveChangeRequest(getState(), attributeId, value);

      if (!request) {
        return showResult({
          status: "error",
          code: "unknown-target",
          message: `${attributeId} cannot be addressed in the current configuration.`,
        });
      }

      const evaluation = evaluate(request);
      const appliesAtOnce = evaluation.kind === "planned" && evaluation.confirmation.length === 0;

      return showResult(await (appliesAtOnce ? runStep(() => change(request)) : change(request)));
    },
    [attributeId, change, evaluate, getState, runStep, showResult],
  );

  const onConfirm = useCallback(async (): Promise<ChangeResult | null> => {
    if (!preview) return null;

    return showResult(await runStep(() => confirm(preview)));
  }, [confirm, preview, runStep, showResult]);

  const onCancel = useCallback(() => setPreview(null), []);

  return { onChange, preview, onConfirm, onCancel, notice };
};
