import { createBrowserRouter, Navigate } from "react-router-dom";

import {
  CustomCabinetColorsPage,
  CustomCountertopPage,
  CustomAccessoriesPage,
  CustomFaucetHolesPage,
  CustomSummaryPage,
  HomePage,
  ModelPage,
  PrebuiltAccessoriesPage,
  PrebuiltCabinetPage,
  PrebuiltCountertopPage,
  PrebuiltSummaryPage,
  CabinetBuilderPage,
} from "@/pages";

import { ROUTES } from "@/shared";

export const routerConfig = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <HomePage />,
    children: [
      {
        index: true,
        element: <Navigate to="prebuilt/model" replace />,
      },
      {
        path: ROUTES.PREBUILT.slice(1),
        children: [
          { index: true, element: <Navigate to="model" replace /> },
          { path: "model", element: <ModelPage /> },
          { path: "cabinet", element: <PrebuiltCabinetPage /> },
          { path: "countertop", element: <PrebuiltCountertopPage /> },
          { path: "accessories", element: <PrebuiltAccessoriesPage /> },
          { path: "summary", element: <PrebuiltSummaryPage /> },
        ],
      },
      {
        path: ROUTES.CUSTOM.slice(1),
        children: [
          { index: true, element: <Navigate to="cabinet-builder" replace /> },
          { path: "cabinet-builder", element: <CabinetBuilderPage /> },
          { path: "cabinet-colors", element: <CustomCabinetColorsPage /> },
          { path: "countertop", element: <CustomCountertopPage /> },
          { path: "accessories", element: <CustomAccessoriesPage /> },
          { path: "faucet-holes", element: <CustomFaucetHolesPage /> },
          { path: "summary", element: <CustomSummaryPage /> },
        ],
      },
    ],
  },
  {
    path: ROUTES.NOT_FOUND,
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
