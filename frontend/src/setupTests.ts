// Extend Jest-DOM matchers for Vitest
// https://testing-library.com/docs/react-testing-library/setup#vitest
// https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest'; // Note: Use /vitest for Vitest v0.32.0+
// If using an older version of Vitest or if the above doesn't work, you might need:
// import '@testing-library/jest-dom';

// Optional: Clear mocks between tests if needed, though Vitest does this by default for `vi.fn()`
// import { vi } from 'vitest';
// afterEach(() => {
//   vi.clearAllMocks();
// });

// Optional: Global setup for MSW (Mock Service Worker) if you're using it for API mocking
// import { server } from './mocks/server'; // Assuming your MSW server setup is in src/mocks/
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// afterAll(() => server.close());
// afterEach(() => server.resetHandlers());

// Any other global setup you need for your tests can go here.
console.log('Vitest setup file loaded.');
