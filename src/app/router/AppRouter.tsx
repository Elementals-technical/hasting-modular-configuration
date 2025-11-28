import { RouterProvider } from "react-router-dom";
import { routerConfig } from "./routerConfig";

interface AppRouterProps {}

export function AppRouter({}: AppRouterProps) {
  return <RouterProvider router={routerConfig} />;
}
