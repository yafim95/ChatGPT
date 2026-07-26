import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  describeFrontendError,
  reportFrontendDiagnostic,
} from "./frontendDiagnostics";

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
      <main className="frontend-failure" role="alert">
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
        <button type="button" onClick={() => window.location.reload()}>
          Reload interface
        </button>
      </main>
    );
  }
}
