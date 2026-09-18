import { createBrowserRouter, Navigate } from "react-router-dom";

import { ArDownloadPage, HomePage, RestoreConfigurationPage } from "@/pages";
import { ROUTES } from "@/shared";
import { CollectionRouterRoot } from "./CollectionRouterRoot";
import { CollectionStepRoutes } from "./CollectionStepRoutes";

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
          { path: "*", element: <CollectionStepRoutes /> },
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
]);
