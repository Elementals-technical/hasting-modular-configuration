import type { ReactElement } from "react";
import type { RouteObject } from "react-router-dom";

import {
  CUSTOMIZATION_FLOW_IDS,
  type CustomizationFlowId,
  type CustomizationSchema,
  type CustomizationScreenId,
  type CustomizationScreenKind,
} from "@/entities/collection";

export type StepScreen = {
  element: (stepId: string) => ReactElement;
  children?: RouteObject[];
  detailRoutes?: RouteObject[];
};

export type StepScreens = Record<CustomizationScreenKind | CustomizationScreenId, StepScreen>;

const toRelativePath = (path: string): string => path.replace(/^\//, "");

const firstSegment = (path: string): string => toRelativePath(path).split("/")[0];

export const buildStepRoutes = (schema: CustomizationSchema, screens: StepScreens): RouteObject[] =>
  CUSTOMIZATION_FLOW_IDS.flatMap((flowId) =>
    schema.flows[flowId].steps.flatMap((ref) => {
      const definition = schema.steps[ref.stepId];
      if (!definition) return [];

      const screen = screens[ref.screen ?? definition.kind];
      const path = toRelativePath(ref.path);

      return [
        { path, element: screen.element(ref.stepId), children: screen.children },
        ...(screen.detailRoutes ?? []).map((route) => ({ ...route, path: `${path}/${route.path}` })),
      ];
    }),
  );

export const resolveFlowForPath = (schema: CustomizationSchema, pathname: string): CustomizationFlowId => {
  const segment = firstSegment(pathname);

  return (
    CUSTOMIZATION_FLOW_IDS.find((flowId) =>
      schema.flows[flowId].steps.some((ref) => firstSegment(ref.path) === segment),
    ) ?? "prebuilt"
  );
};
