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
  CabinetStyleDetailsPage,
  RestoreConfigurationPage,
} from "@/pages";

import { ROUTES } from "@/shared";
import { SummaryPage } from "@/pages/prebuilt/summary/SummaryPage";
import { CollectionRouterRoot } from "./CollectionRouterRoot";
import { FlowEntryRedirect } from "./FlowEntryRedirect";

export const routerConfig = createBrowserRouter([
  {
    element: <CollectionRouterRoot />,
    children: [
      {
        path: ROUTES.HOME,
        element: <HomePage />,
        children: [
          {
            index: true,
            element: <Navigate to="prebuilt" replace />,
          },
          {
            path: ROUTES.PREBUILT.slice(1),
            children: [
              { index: true, element: <FlowEntryRedirect flow="prebuilt" /> },
              {
                path: "model",
                element: <ModelPage />,
                children: [{ path: ":modelId", element: <ModelDetailsPage /> }],
              },
              { path: "color", element: <CabinetPage /> },
              { path: "countertop", element: <CountertopPage /> },
              { path: "accessories", element: <AccessoriesPage /> },
              { path: "faucet-holes", element: <FaucetPage /> },
              { path: "summary", element: <SummaryPage /> },
              { path: "*", element: <FlowEntryRedirect flow="prebuilt" /> },
            ],
          },
          {
            path: ROUTES.CUSTOM.slice(1),
            children: [
              { index: true, element: <FlowEntryRedirect flow="custom" /> },
              { path: "cabinet-builder", element: <CabinetBuilderPage /> },
              { path: "cabinet-builder/details/style", element: <CabinetStyleDetailsPage /> },
              { path: "cabinet-colors", element: <CustomCabinetColorsPage /> },
              { path: "countertop", element: <CustomCountertopPage /> },
              { path: "accessories", element: <CustomAccessoriesPage /> },
              { path: "faucet-holes", element: <CustomFaucetHolesPage /> },
              { path: "summary", element: <CustomSummaryPage /> },
              { path: "*", element: <FlowEntryRedirect flow="custom" /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: ROUTES.RESTORE,
    element: <RestoreConfigurationPage />,
  },
  {
    path: ROUTES.AR_DOWNLOAD,
    element: <ArDownloadPage />,
  },
  {
    path: ROUTES.NOT_FOUND,
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
