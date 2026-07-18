import "@testing-library/jest-dom/vitest";

// Fluent UI's focus-management package expects this DOM constructor globally.
Object.defineProperty(globalThis, "NodeFilter", {
  configurable: true,
  value: window.NodeFilter,
});
