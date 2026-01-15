import { createBrowserRouter, Navigate } from "react-router-dom";

import {
  CustomCabinetColorsPage,
  CustomCountertopPage,
  CustomAccessoriesPage,
  CustomFaucetHolesPage,
  CustomSummaryPage,
  HomePage,
  ModelPage,
  AccessoriesPage,
  CountertopPage,
  FaucetPage,
  CabinetBuilderPage,
  CabinetPage,
  ModelDetailsPage,
  ArDownloadPage,
} from "@/pages";

import { ROUTES } from "@/shared";
import { SummaryPage } from "@/pages/prebuilt/summary/SummaryPage";

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
          {
            path: "model",
            element: <ModelPage />,
            children: [{ path: ":modelId", element: <ModelDetailsPage /> }],
          },
          { path: "cabinet", element: <CabinetPage /> },
          { path: "countertop", element: <CountertopPage /> },
          { path: "accessories", element: <AccessoriesPage /> },
          { path: "faucet-holes", element: <FaucetPage /> },
          { path: "summary", element: <SummaryPage /> },
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
  {
    path: ROUTES.AR_DOWNLOAD,
    element: <ArDownloadPage />,
  },
]);
