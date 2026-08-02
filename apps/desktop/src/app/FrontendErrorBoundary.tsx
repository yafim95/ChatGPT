import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  describeFrontendError,
  reportFrontendDiagnostic,
} from "./frontendDiagnostics";
import { openDiagnosticsFolder, resetRenderer } from "./rendererLifecycle";

interface FrontendErrorBoundaryProps {
  children: ReactNode;
}

interface FrontendErrorBoundaryState {
  message?: string;
}

export class FrontendErrorBoundary extends Component<
  FrontendErrorBoundaryProps,
  FrontendErrorBoundaryState
> {
  state: FrontendErrorBoundaryState = {};

  static getDerivedStateFromError(error: unknown): FrontendErrorBoundaryState {
    return { message: describeFrontendError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack?.trim();
    const detail = componentStack
      ? `${describeFrontendError(error)}\nReact component stack:\n${componentStack}`
      : describeFrontendError(error);
    void reportFrontendDiagnostic("react-render-error", detail).catch(
      () => undefined,
    );
  }

  render(): ReactNode {
    if (!this.state.message) {
      return this.props.children;
    }

    return (
      <main className="frontend-failure" data-projectmind-surface role="alert">
        <div className="frontend-failure__mark" aria-hidden="true">
          !
        </div>
        <h1>ProjectMind interface could not load</h1>
        <p>
          Your local project data was not changed. The technical details were
          saved to the desktop diagnostic log.
        </p>
        <code>
          %LOCALAPPDATA%\com.projectmind.engineeringai\logs\desktop.log
        </code>
        <details>
          <summary>Technical detail</summary>
          <pre>{this.state.message}</pre>
        </details>
        <div className="frontend-failure__actions">
          <button type="button" onClick={() => window.location.reload()}>
            Reload interface
          </button>
          <button
            type="button"
            onClick={() => void resetRenderer().catch(() => undefined)}
          >
            Reset interface cache
          </button>
          <button
            type="button"
            onClick={() => void openDiagnosticsFolder().catch(() => undefined)}
          >
            Open diagnostics folder
          </button>
        </div>
      </main>
    );
  }
}
