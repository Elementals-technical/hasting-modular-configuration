import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "@/app/App";
import { store } from "@/app/store";
import { getDividerUiDebug } from "@/utils/functions/playcanvas/dividers";

import "@/shared/assets/styles/index.scss";

getDividerUiDebug();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
