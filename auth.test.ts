import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia, t } from "elysia"; // Import t for schema if needed for app instance
import { edenTreaty } from '@elysiajs/eden'; // For type-safe client
import app from './index'; // Import your main app instance

// Type-safe client for your app
// Assuming your app instance is exported from index.ts
// The actual app instance might need to be slightly modified or wrapped for testing if it starts listening immediately.
// For now, let's assume 'app' is the Elysia instance without .listen() called, or it's handled.

// Helper to get a server instance for testing
const TestApp = app; // Use the imported app directly

const api = edenTreaty<typeof TestApp>('http://localhost:3000'); // Use a dummy URL, requests are made in-process

describe('Authentication Endpoints', () => {
  // Register Endpoint
  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const uniqueUsername = `testuser_${Date.now()}`;
      const password = 'password123';

      const { data, error, status } = await api.auth.register.post({
        username: uniqueUsername,
        password: password,
      });
      
      expect(status).toBe(201);
      expect(data?.message).toBe('User registered successfully');
      expect(error).toBeNull();
    });

    it('should fail to register with an existing username', async () => {
      const username = `existinguser_${Date.now()}`;
      const password = 'password123';

      // First registration
      await api.auth.register.post({ username, password });

      // Attempt to register again
      const { data, error, status } = await api.auth.register.post({
        username: username,
        password: 'anotherpassword',
      });

      expect(status).toBe(409); // Conflict
      expect(data).toBeNull();
      expect(error?.value.error).toBe('Username already taken');
    });

    it('should fail to register with missing username', async () => {
      const { data, error, status } = await api.auth.register.post({
        // @ts-expect-error Testing invalid input
        username: undefined,
        password: 'password123',
      });
      
      // Elysia's validation should catch this. The status code might depend on global error handling.
      // It often results in a 400 or 422 if validation is built-in.
      expect(status).toBe(400); 
      expect(error?.value.error).toBeDefined(); // Or a more specific message if available
    });

    it('should fail to register with missing password', async () => {
      const { data, error, status } = await api.auth.register.post({
        username: `user_no_pass_${Date.now()}`,
        // @ts-expect-error Testing invalid input
        password: undefined,
      });
      expect(status).toBe(400);
      expect(error?.value.error).toBeDefined();
    });
  });

  // Login Endpoint
  describe('POST /auth/login', () => {
    const username = `loginuser_${Date.now()}`;
    const password = 'password123';

    beforeAll(async () => {
      // Register a user to be used for login tests
      await api.auth.register.post({ username, password });
    });

    it('should login successfully with correct credentials', async () => {
      const { data, error, status, cookie } = await api.auth.login.post({ username, password });
      
      expect(status).toBe(200);
      expect(data?.message).toBe('Login successful');
      expect(data?.user?.username).toBe(username);
      expect(error).toBeNull();
      // Check for session_id cookie (name might vary based on Elysia's cookie plugin or manual setup)
      // edenTreaty should handle cookies, but direct inspection of `cookie` object from response might be needed.
      // The `cookie` object in eden's response is a record of received Set-Cookie headers.
      expect(cookie?.session_id?.value).toBeDefined();
      expect(cookie?.session_id?.httpOnly).toBe(true);
    });

    it('should fail to login with incorrect password', async () => {
      const { data, error, status } = await api.auth.login.post({
        username: username,
        password: 'wrongpassword',
      });
      expect(status).toBe(401);
      expect(data).toBeNull();
      expect(error?.value.error).toBe('Invalid username or password');
    });

    it('should fail to login with non-existent username', async () => {
      const { data, error, status } = await api.auth.login.post({
        username: `nonexistent_${Date.now()}`,
        password: 'password123',
      });
      expect(status).toBe(401);
      expect(data).toBeNull();
      expect(error?.value.error).toBe('Invalid username or password');
    });
  });

  // /auth/me Endpoint
  describe('GET /auth/me', () => {
    const username = `me_user_${Date.now()}`;
    const password = 'password123';
    let userCookies: Record<string, { value: string }> = {};

    beforeAll(async () => {
      // Register and login user to get session cookie
      await api.auth.register.post({ username, password });
      const loginResponse = await api.auth.login.post({ username, password });
      if (loginResponse.cookie?.session_id) {
        // @ts-ignore
        userCookies['session_id'] = { value: loginResponse.cookie.session_id.value };
      }
    });

    it('should return user details if authenticated', async () => {
      if (!userCookies.session_id) throw new Error("Login failed in beforeAll, no cookie for /me test.");
      
      const { data, error, status } = await api.auth.me.get({
        // edenTreaty client automatically sends cookies from its internal store
        // that were set by previous responses from the same domain.
        // If manual cookie sending is needed (e.g. if client instance is recreated):
        // $fetch: { headers: { cookie: `session_id=${userCookies.session_id.value}` } }
      });

      expect(status).toBe(200);
      expect(data?.user?.username).toBe(username);
      expect(error).toBeNull();
    });

    it('should return 401 if not authenticated', async () => {
      // Make request with a fresh client instance that doesn't have the cookie
      const unauthenticatedApi = edenTreaty<typeof TestApp>('http://localhost:3000');
      const { data, error, status } = await unauthenticatedApi.auth.me.get();
      
      expect(status).toBe(401);
      expect(data).toBeNull();
      expect(error?.value.error).toBe('Unauthorized');
    });
  });

  // /auth/logout Endpoint
  describe('POST /auth/logout', () => {
    const username = `logout_user_${Date.now()}`;
    const password = 'password123';
    
    beforeAll(async () => {
      await api.auth.register.post({ username, password });
      // Login to establish a session that can be logged out
      // The `api` instance will store the cookie from this login.
      await api.auth.login.post({ username, password });
    });

    it('should logout successfully and clear session', async () => {
      const { data, error, status, cookie } = await api.auth.logout.post({});
      
      expect(status).toBe(200);
      expect(data?.message).toBe('Logout successful');
      expect(error).toBeNull();
      
      // Check if the session_id cookie is cleared.
      // A cleared cookie is often sent back with an empty value and/or Max-Age=0 or an expiry date in the past.
      expect(cookie?.session_id?.value).toBe(''); // Or check Max-Age or Expires

      // Verify by trying to access /auth/me, which should now fail
      const meResponse = await api.auth.me.get();
      expect(meResponse.status).toBe(401);
      expect(meResponse.error?.value.error).toBe('Unauthorized');
    });
  });
});

// Note: To run this, you might need to ensure your main app (index.ts)
// doesn't immediately call .listen() when imported, or use a conditional listen.
// e.g., in index.ts:
// if (process.env.NODE_ENV !== 'test') {
//   app.listen(3000);
// }
// export default app; // Ensure app is exported for testing
//
// And in your package.json scripts:
// "test": "NODE_ENV=test bun test"
//
// The edenTreaty client makes direct function calls to the handlers for 'bun:test'
// so no actual HTTP server needs to be running for these tests if structured correctly.
// However, the provided code uses a URL with edenTreaty, which implies it *might* try to make HTTP requests.
// For bun:test, it's often more direct:
// const response = await app.handle(new Request('http://localhost/auth/register', { method: 'POST', body: JSON.stringify(payload), headers: {'Content-Type': 'application/json'} }));
// const result = await response.json();
// This needs to be clarified from Elysia's latest testing patterns with Bun. For now, assuming edenTreaty works as an in-process client.
// If `edenTreaty` always makes real HTTP calls, then the server needs to be started.
// `app.handle` is the way for in-process testing. Let's adjust if edenTreaty is problematic.

// For now, the structure above assumes edenTreaty can work with the app instance directly for testing.
// If `index.ts` calls `.listen()`, tests might hang or fail.
// A common pattern is:
// const app = new Elysia()... (define routes)
// if (import.meta.main) { app.listen(3000) } // or check process.env.NODE_ENV
// export default app
// This ensures listen() is only called when running `bun index.ts` not when importing.

// Let's assume the app is structured to be importable without side effects like .listen().
// The console.log in db.ts regarding "Using database: test_db.sqlite" confirms NODE_ENV=test is picked up.
// The `require('node:fs')` in `db.ts` might be better as `import fs from 'node:fs';` at the top.
// Bun's test runner automatically sets NODE_ENV to 'test' for .test.ts files.
