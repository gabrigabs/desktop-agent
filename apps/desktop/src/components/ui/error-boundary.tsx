import * as React from "react";
import { type WithTranslation, withTranslation } from "react-i18next";

type Props = {
  children: React.ReactNode;
} & WithTranslation;

type State = {
  error: Error | null;
};

class ErrorBoundaryInner extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("React surface crashed:", error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { t } = this.props;
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-zinc-100">
        <div className="text-sm font-semibold">{t("common:errorBoundary.title")}</div>
        <p className="max-w-[280px] text-xs leading-relaxed text-zinc-500">
          {t("common:errorBoundary.description")}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-700 hover:text-zinc-50"
        >
          {t("common:errorBoundary.reload")}
        </button>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation("common")(ErrorBoundaryInner);
