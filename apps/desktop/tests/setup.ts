import "@testing-library/jest-dom/vitest";

// Fluent UI's focus-management package expects this DOM constructor globally.
Object.defineProperty(globalThis, "NodeFilter", {
  configurable: true,
  value: {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ALL: 0xffffffff,
    SHOW_ELEMENT: 0x1,
    SHOW_TEXT: 0x4,
  },
});
