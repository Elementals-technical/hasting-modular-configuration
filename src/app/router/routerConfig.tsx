import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "../../pages/home/HomePage";

import { ROUTES } from "../../shared";

export const routerConfig = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <HomePage />,
  },
]);
