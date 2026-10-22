import { useEffect, type CSSProperties } from "react";

import { useReasonText } from "@/shared/lib/reasonText";

import { dismissSceneRefusal, useSceneRefusal } from "../lib/sceneRefusalNotice";
import s from "./SceneRefusalNotice.module.scss";

/** How long a refusal stays on screen unless the user closes it. */
const SCENE_REFUSAL_NOTICE_MS = 6000;

type Props = { style?: CSSProperties };

/** Why the scene did not take the last add / duplicate / swap; closes itself. */
export const SceneRefusalNotice = ({ style }: Props) => {
  const reason = useSceneRefusal();
  const reasonText = useReasonText();

  useEffect(() => {
    if (!reason) return;
    const timer = window.setTimeout(dismissSceneRefusal, SCENE_REFUSAL_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [reason]);

  if (!reason) return null;

  return (
    <div className={s.notice} style={style}>
      <p className={s.text} role="alert">
        {reasonText(reason)}
      </p>
      <button type="button" className={s.close} aria-label="Close" onClick={dismissSceneRefusal}>
        ×
      </button>
    </div>
  );
};
