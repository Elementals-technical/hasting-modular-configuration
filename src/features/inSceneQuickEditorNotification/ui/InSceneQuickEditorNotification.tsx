import { useId } from "react";

import clsx from "clsx";

import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import {
  IN_SCENE_QUICK_EDITOR_NOTIFICATION_DEFAULT_CONTENT,
  IN_SCENE_QUICK_EDITOR_NOTIFICATION_PANEL_WIDTH,
} from "../lib/constants";

import type { InSceneQuickEditorNotificationContent } from "../model/types";

import s from "./InSceneQuickEditorNotification.module.scss";

type InSceneQuickEditorNotificationProps = {
  content?: InSceneQuickEditorNotificationContent;
  className?: string;
  onClose?: () => void;
};

export const InSceneQuickEditorNotification = ({
  content = IN_SCENE_QUICK_EDITOR_NOTIFICATION_DEFAULT_CONTENT,
  className,
  onClose,
}: InSceneQuickEditorNotificationProps) => {
  const titleId = useId();

  return (
    <div
      className={clsx(s.notification, className)}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      style={{ width: `${IN_SCENE_QUICK_EDITOR_NOTIFICATION_PANEL_WIDTH}px` }}
    >
      <div className={s.glow} aria-hidden="true" />

      <div className={s.panel}>
        <div className={s.header}>
          <div className={s.title} id={titleId}>
            {content.title}
          </div>

          <button
            type="button"
            className={s.closeButton}
            onClick={onClose}
            aria-label={content.closeButtonAriaLabel}
          >
            <CloseBtnIcon />
          </button>
        </div>

        <div className={s.content}>
          {content.intro && <p className={s.intro}>{content.intro}</p>}

          {!!content.details?.length && (
            <ul className={s.detailList}>
              {content.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>

        <div className={s.footer}>
          <BaseButton variant="ghost" size="sm" onClick={onClose}>
            {content.closeButtonLabel}
          </BaseButton>
        </div>
      </div>
    </div>
  );
};
