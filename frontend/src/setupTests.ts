import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true, // Allow tests to spyOn or further modify if needed
});

// Clear localStorage before each test to ensure isolation
beforeEach(() => {
  localStorageMock.clear();
});

// Optional: Clear all mocks (vi.fn(), vi.spyOn) before each test
// Vitest does this for vi.fn() by default if `clearMocks: true` is in config,
// but explicit can be clearer or cover more cases.
// beforeEach(() => {
//   vi.clearAllMocks();
// });

console.log('Vitest setup file loaded with localStorage mock.');
