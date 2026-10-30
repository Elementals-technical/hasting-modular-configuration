import {
  AccessoriesPage,
  CabinetBuilderPage,
  CabinetPage,
  CabinetStyleDetailsPage,
  CountertopPage,
  CustomCabinetColorsPage,
  CustomSummaryPage,
  FieldsStepPage,
  ModelDetailsPage,
  ModelPage,
  SummaryPage,
} from "@/pages";
import type { StepScreens } from "@/features/collectionCustomization";

export const stepScreens: StepScreens = {
  "preset-picker": {
    element: () => <ModelPage />,
    children: [{ path: ":modelId", element: <ModelDetailsPage /> }],
  },
  "cabinet-builder": {
    element: () => <CabinetBuilderPage />,
    detailRoutes: [{ path: "details/style", element: <CabinetStyleDetailsPage /> }],
  },
  fields: { element: (stepId) => <FieldsStepPage stepId={stepId} /> },
  countertop: { element: (stepId) => <CountertopPage stepId={stepId} /> },
  accessories: { element: (stepId) => <AccessoriesPage stepId={stepId} /> },
  summary: { element: () => <SummaryPage /> },
  "prebuilt-cabinet": { element: () => <CabinetPage /> },
  "custom-cabinet-colors": { element: () => <CustomCabinetColorsPage /> },
  "custom-summary": { element: () => <CustomSummaryPage /> },
};
