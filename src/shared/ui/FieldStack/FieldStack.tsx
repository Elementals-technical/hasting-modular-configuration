import type { PropsWithChildren } from "react";
import s from "./FieldStack.module.scss";

/** Spacing between the visible fields of a configurator section. */
export const FieldStack = ({ children }: PropsWithChildren) => <div className={s.stack}>{children}</div>;
