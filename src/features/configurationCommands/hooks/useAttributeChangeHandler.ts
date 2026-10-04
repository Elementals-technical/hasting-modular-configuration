import { useCallback, useState } from "react";

import type { AttributeValue } from "@/entities/configuration";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";

import { evaluateChange } from "../lib/evaluateChange";
import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import type { ChangePreview, ChangeResult } from "../model/types";
import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

/**
 * The selection handler C hands to a field (EXECUTION §1: C06 -> B06).
 *
 * A field passes the picked value to `onChange`; the handler addresses it at the scope the
 * profile declares and runs it through the command service. A history step is recorded
 * only for a change that is about to be applied, so a preview the user cancels leaves no
 * empty undo step. A change that needs approval comes back as `preview` for the field's
 * dialog (`onConfirm` / `onCancel`); a change the rules refuse comes back as `notice`.
 */
export const useAttributeChangeHandler = (attributeId: string, { runtime }: UseChangeAttributeOptions = {}) => {
  const { change, confirm, getState } = useChangeAttribute({ runtime });
  const saveSnapshot = useHistorySnapshot();
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

      const evaluation = evaluateChange(request, getState());
      if (evaluation.kind === "planned" && evaluation.confirmation.length === 0) {
        await saveSnapshot();
      }

      return showResult(await change(request));
    },
    [attributeId, change, getState, saveSnapshot, showResult],
  );

  const onConfirm = useCallback(async (): Promise<ChangeResult | null> => {
    if (!preview) return null;

    await saveSnapshot();
    return showResult(await confirm(preview));
  }, [confirm, preview, saveSnapshot, showResult]);

  const onCancel = useCallback(() => setPreview(null), []);

  return { onChange, preview, onConfirm, onCancel, notice };
};
