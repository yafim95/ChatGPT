import { createContext, useContext } from "react";

export const LocaleContext = createContext("en-AE");

export function useAppLocale(): string {
  return useContext(LocaleContext);
}
