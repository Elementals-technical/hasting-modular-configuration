import { useState, type CSSProperties } from "react";

import { classifyCountertopError, type CountertopApi } from "@/features/configuratorApi";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import { getCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import { useReasonText } from "@/shared/lib/reasonText";

import s from "./CountertopDragMode.module.scss";

type Props = { getApi: () => CountertopApi | null; disabled?: boolean; style?: CSSProperties };

/** Offset-only top restored in a lifted pose (`verticalLockViolated`): offer to lower it or reset it. */
export const CountertopVerticalLockNotice = ({ getApi, disabled = false, style }: Props) => {
  const violated = useCountertopRuntimeValue((state) => state?.verticalLockViolated === true);
  const reasonText = useReasonText();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!violated) return null;

  const run = (action: (api: CountertopApi) => unknown) => {
    const api = getApi();
    if (!api) return;
    setPending(true);
    setError(null);
    void Promise.resolve()
      .then(() => action(api))
      .catch((failure: unknown) => {
        const { code, reasons, message } = classifyCountertopError(failure);
        setError(reasonText({ code: reasons[0] ?? code ?? undefined, text: message }) ?? message);
      })
      .finally(() => setPending(false));
  };
  const busy = disabled || pending;

  return (
    <div role="status" aria-label="Countertop vertical lock" style={style}>
      <p className={s.message}>{reasonText({ code: "countertop.verticalLockViolated" })}</p>
      <div className={s.toolbarButtons}>
        <button
          type="button"
          className={s.secondaryPill}
          disabled={busy}
          onClick={() => run((api) => api.setOffset({ x: getCountertopRuntimeState()?.offset?.x ?? 0, y: 0 }))}
        >
          Lower
        </button>
        <button type="button" className={s.secondaryPill} disabled={busy} onClick={() => run((api) => api.resetOffset())}>
          Reset
        </button>
      </div>
      {error && (
        <p className={s.message} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
