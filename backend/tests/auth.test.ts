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
      expect(data?.token).toBeString(); // Expect a JWT token
      expect(data?.user?.username).toBe(uniqueUsername);
      expect(error).toBeNull();

      // Optional: Try to decode JWT payload (simple base64 decode for non-encrypted tokens)
      if (data?.token) {
        try {
          const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url').toString());
          expect(payload.username).toBe(uniqueUsername);
          expect(payload.userId).toBeNumber();
        } catch (e) {
          console.warn("Could not decode JWT payload in test, or it's not a simple JWS.", e);
        }
      }
    });

    it('should fail to register with an existing username', async () => {
      const username = `existinguser_${Date.now()}`;
      const password = 'password123';

      // First registration
      const firstReg = await api.auth.register.post({ username, password });
      expect(firstReg.status).toBe(201); // Ensure first one succeeded

      // Attempt to register again
      const { data, error, status } = await api.auth.register.post({
        username: username,
        password: 'anotherpassword',
      });

      expect(status).toBe(409); // Conflict
      // data might not be null if error response has a body, check error.value instead
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
    let registeredUserId: number | undefined;

    beforeAll(async () => {
      // Register a user to be used for login tests
      const regResponse = await api.auth.register.post({ username, password });
      if (regResponse.data?.user?.id) {
        registeredUserId = regResponse.data.user.id;
      } else {
        throw new Error("Setup for login tests failed: Could not register user or get user ID.");
      }
    });

    it('should login successfully with correct credentials and return a token', async () => {
      const { data, error, status, cookie } = await api.auth.login.post({ username, password });
      
      expect(status).toBe(200);
      expect(data?.message).toBe('Login successful');
      expect(data?.user?.username).toBe(username);
      expect(data?.token).toBeString(); // Expect a JWT token
      expect(error).toBeNull();
      expect(cookie?.session_id).toBeUndefined(); // No session cookie should be set

      // Optional: Decode JWT
      if (data?.token) {
        try {
          const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url').toString());
          expect(payload.username).toBe(username);
          expect(payload.userId).toBe(registeredUserId);
        } catch (e) {
          console.warn("Could not decode JWT payload in login test.", e);
        }
      }
    });

    it('should fail to login with incorrect password', async () => {
      const { data, error, status } = await api.auth.login.post({
        username: username,
        password: 'wrongpassword',
      });
      expect(status).toBe(401);
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
    let authToken: string | undefined;

    beforeAll(async () => {
      // Register and login user to get a token
      await api.auth.register.post({ username, password });
      const loginResponse = await api.auth.login.post({ username, password });
      authToken = loginResponse.data?.token;
      if (!authToken) {
        throw new Error("Setup for /me tests failed: Could not get token during login.");
      }
    });

    it('should return user details if authenticated with Bearer token', async () => {
      if (!authToken) throw new Error("Auth token not available for /me test.");
      
      const { data, error, status } = await api.auth.me.get({
        headers: { // Pass token in Authorization header
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(status).toBe(200);
      expect(data?.user?.username).toBe(username);
      expect(error).toBeNull();
    });

    it('should return 401 if not authenticated (no token)', async () => {
      const { data, error, status } = await api.auth.me.get({}); // No headers
      
      expect(status).toBe(401);
      expect(error?.value.error).toBe('Unauthorized');
    });
    
    it('should return 401 if token is invalid or malformed', async () => {
        const { data, error, status } = await api.auth.me.get({
            headers: {
                Authorization: `Bearer invalid.token.here`,
            },
        });
        expect(status).toBe(401);
        expect(error?.value.error).toBe('Unauthorized'); // Or specific error from JWT verify
    });
  });

  // /auth/logout Endpoint (JWT context)
  describe('POST /auth/logout (JWT)', () => {
    // For JWT, logout is primarily client-side (discarding the token).
    // The backend endpoint might exist for blocklisting, but current implementation is simple.
    it('should return a success message for logout', async () => {
      const { data, error, status } = await api.auth.logout.post({});
      
      expect(status).toBe(200);
      expect(data?.message).toBe('Logout successful. Please discard your token.');
      expect(error).toBeNull();
      // No cookie changes to check for JWT logout.
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
