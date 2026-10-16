import { MobileLandscapeStub } from "@/shared/ui/MobileLandscapeStub/MobileLandscapeStub";

import "./App.scss";
import { AppRouter } from "./router/AppRouter";

export function App() {
  return (
    <>
      <AppRouter />
      <MobileLandscapeStub />
    </>
  );
}
