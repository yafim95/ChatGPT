import { useEffect } from "react";
import { LocaleContext } from "./LocaleContext";

interface AppLocaleProviderProps {
  locale: string;
  children: React.ReactNode;
}

export function AppLocaleProvider({
  locale,
  children,
}: AppLocaleProviderProps): React.JSX.Element {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
