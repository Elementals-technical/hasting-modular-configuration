import {
  AccessoriesPage,
  CabinetBuilderPage,
  CabinetPage,
  CabinetStyleDetailsPage,
  CountertopPage,
  CustomAccessoriesPage,
  CustomCabinetColorsPage,
  CustomCountertopPage,
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
  summary: { element: () => <SummaryPage /> },
  "prebuilt-cabinet": { element: () => <CabinetPage /> },
  "prebuilt-countertop": { element: () => <CountertopPage /> },
  "prebuilt-accessories": { element: () => <AccessoriesPage /> },
  "custom-cabinet-colors": { element: () => <CustomCabinetColorsPage /> },
  "custom-countertop": { element: () => <CustomCountertopPage /> },
  "custom-accessories": { element: () => <CustomAccessoriesPage /> },
  "custom-summary": { element: () => <CustomSummaryPage /> },
};
