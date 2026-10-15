import React, { Component, type ReactNode } from "react";
import { ErrorDisplay } from "@/components/error-boundary-parts";

type YearViewErrorBoundaryInnerProps = {
  message: string;
  reloadLabel: string;
  backLabel: string;
  backHref: string;
  onReload: () => void;
  children: ReactNode;
};

type YearViewErrorBoundaryInnerState = {
  hasError: boolean;
  error: Error | null;
};

// eslint-disable-next-line functional/no-classes
class YearViewErrorBoundaryInner extends Component<
  YearViewErrorBoundaryInnerProps,
  YearViewErrorBoundaryInnerState
> {
  state: YearViewErrorBoundaryInnerState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): YearViewErrorBoundaryInnerState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo): void {
    // telemetry removed
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          message={this.props.message}
          reloadLabel={this.props.reloadLabel}
          backLabel={this.props.backLabel}
          backHref={this.props.backHref}
          onReload={this.props.onReload}
        />
      );
    }
    return this.props.children;
  }
}

type YearViewErrorBoundaryProps = {
  year?: number;
  children: ReactNode;
};

export default function YearViewErrorBoundary({ year, children }: YearViewErrorBoundaryProps) {
  const handleReload = () => {
    window.location.reload();
  };

  const backHref = year != null ? `/year/${year}` : "/";

  return (
    <YearViewErrorBoundaryInner
      message="Something went wrong loading the year view."
      reloadLabel="Reload"
      backLabel={year != null ? "Back to year view" : "Home"}
      backHref={backHref}
      onReload={handleReload}
    >
      {children}
    </YearViewErrorBoundaryInner>
  );
}
