import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";
import { FrontendErrorBoundary } from "./app/FrontendErrorBoundary";
import { installGlobalFrontendDiagnostics } from "./app/frontendDiagnostics";
import { queryClient } from "./app/queryClient";
import { reportRendererMounted } from "./app/rendererLifecycle";
import "./styles/global.css";

installGlobalFrontendDiagnostics();

const root = document.getElementById("root");
if (!root) {
  throw new Error("ProjectMind root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <FrontendErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </FrontendErrorBoundary>
  </StrictMode>,
);

void reportRendererMounted();
