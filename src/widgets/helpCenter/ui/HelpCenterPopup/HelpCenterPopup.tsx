import { BaseButton } from "@/shared";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { PopupRightContent } from "@/shared/ui/Popups/PopupRightContent/PopupRightContent";

import s from "./HelpCenterPopup.module.scss";
import { ArrowLeft } from "@/shared/assets/images/svg/ArrowLeft";

export interface HelpCenterNode {
  id: string;
  label: string;
  action?: () => void;
  href?: string;
  external?: boolean;
  children?: HelpCenterNode[];
  content?: {
    title: string;
    intro?: string;
    bullets?: string[];
    image?: string;
  };
}

interface HelpCenterPopupProps {
  isOpening: boolean;
  onClose: () => void;
  nodes: HelpCenterNode[];
  path: string[];
  onPathChange: (nextPath: string[]) => void;
}

const getCurrentLevel = (nodes: HelpCenterNode[], path: string[]): HelpCenterNode[] => {
  let level = nodes;

  for (const id of path) {
    const currentNode = level.find((node) => node.id === id);
    if (!currentNode?.children) {
      return level;
    }
    level = currentNode.children;
  }

  return level;
};

const getNodeByPath = (nodes: HelpCenterNode[], path: string[]): HelpCenterNode | null => {
  let level = nodes;
  let node: HelpCenterNode | null = null;

  for (const id of path) {
    node = level.find((item) => item.id === id) ?? null;
    if (!node) return null;
    level = node.children ?? [];
  }

  return node;
};

const getBreadcrumb = (nodes: HelpCenterNode[], path: string[]): string[] => {
  const labels: string[] = [];
  let level = nodes;

  for (const id of path) {
    const currentNode = level.find((node) => node.id === id);
    if (!currentNode) break;

    labels.push(currentNode.label);
    level = currentNode.children ?? [];
  }

  return labels;
};

export const HelpCenterPopup: React.FC<HelpCenterPopupProps> = ({ isOpening, onClose, nodes, path, onPathChange }) => {
  const currentLevel = getCurrentLevel(nodes, path);
  const breadcrumb = getBreadcrumb(nodes, path);
  const currentNode = getNodeByPath(nodes, path);
  const contentNode = currentNode?.content ? currentNode : null;

  const handleItemClick = (item: HelpCenterNode) => {
    if (item.children?.length || item.content) {
      onPathChange([...path, item.id]);
      return;
    }

    item.action?.();
  };

  return (
    <PopupRightContent onClose={onClose} isOpening={isOpening} animationDurationMs={400}>
      <div className={s.instrPopup}>
        <div className={s.header}>
          <div className={s.title}>How can we help?</div>
          <div className={s.button} onClick={onClose}>
            <CloseBtnIcon />
          </div>
        </div>

        <div className={s.content}>
          {!!path.length && (
            <div className={s.sub_header}>
              <button type="button" className={s.backBtn} onClick={() => onPathChange(path.slice(0, -1))}>
                <ArrowLeft />
              </button>
              <div className={s.sub_header__title}>
                {!!breadcrumb.length && <div className={s.breadcrumb}>{breadcrumb.join(" / ")}</div>}
              </div>
            </div>
          )}
          {contentNode ? (
            <div className={s.contentDetails}>
              <div className={s.contentTitle}>{contentNode.content?.title}</div>
              {!!contentNode.content?.intro && <p>{contentNode.content.intro}</p>}
              {!!contentNode.content?.bullets?.length && (
                <ul className={s.contentBulletList}>
                  {contentNode.content.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {!!contentNode.content?.image && (
                <img className={s.contentImage} src={contentNode.content.image} alt={contentNode.content.title} />
              )}
            </div>
          ) : (
            <ul className={s.popupList}>
              {currentLevel.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <a
                      className={s.popupItem}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer noopener" : undefined}
                    >
                      <span>{item.label}</span>
                      <span>
                        <ArrowRight />
                      </span>
                    </a>
                  ) : (
                    <button type="button" className={s.popupItem} onClick={() => handleItemClick(item)}>
                      <span>{item.label}</span>
                      <span>
                        <ArrowRight />
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={s.footer}>
          <BaseButton onClick={onClose} fullWidth={true}>
            Get Started
          </BaseButton>
        </div>
      </div>
    </PopupRightContent>
  );
};
