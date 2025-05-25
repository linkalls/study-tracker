import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { edenTreaty } from '@elysiajs/eden';
import app from './index'; // Your main Elysia app

const TestApp = app; // Use the imported app directly
const api = edenTreaty<typeof TestApp>('http://localhost:3000'); // Base client

// Helper function to get an authenticated API client instance and token
async function getAuthenticatedTestClientAndToken() {
  const uniqueUserSuffix = Date.now();
  const username = `test_session_user_${uniqueUserSuffix}`;
  const password = 'password123';

  // Use a fresh eden client for registration and login to not pollute global `api` instance's potential state
  const tempApiClient = edenTreaty<typeof TestApp>('http://localhost:3000');

  // Register user
  const regResponse = await tempApiClient.auth.register.post({ username, password });
  if (regResponse.status !== 201 || !regResponse.data?.token) {
    console.error('Registration failed in test setup:', regResponse.error, regResponse.data);
    throw new Error('Test setup: User registration failed or no token received');
  }
  const token = regResponse.data.token;
  const userId = regResponse.data.user?.id;
  if (!userId) {
    throw new Error('Test setup: User ID not returned on registration.');
  }

  // No need to call login again if registration returns token and user is considered logged in.
  // The 'api' instance used for tests will need the token in headers.
  // We return the token and let tests use it with the global 'api' or a new instance.
  return { token, userId };
}


describe('Study Session Endpoints (JWT)', () => {
  let authToken: string;
  let currentUserId: number;

  beforeAll(async () => {
    const authDetails = await getAuthenticatedTestClientAndToken();
    authToken = authDetails.token;
    currentUserId = authDetails.userId;
  });

  // Helper to make authenticated requests for this suite
  const makeAuthRequest = (path: keyof (typeof api.api), method: 'get' | 'post' | 'put', body?: any) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    if (method === 'get') {
        // @ts-expect-error - Dynamic path and method
        return api.api[path].get({ headers });
    }
    // @ts-expect-error - Dynamic path and method
    return api.api[path][method](body, { headers });
  };
  
  const makeAuthRequestWithParam = (pathFn: (param: string) => any, paramValue: string, method: 'put', body?: any) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    // @ts-expect-error
    return pathFn(paramValue)[method](body, { headers });
  }


  describe('POST /api/sessions', () => {
    it('should create a new study session successfully', async () => {
      const startTime = new Date().toISOString();
      const taskDescription = 'Test task for new session with JWT';

      // Use the makeAuthRequest helper
      const { data, error, status } = await makeAuthRequest('sessions', 'post', {
        start_time: startTime,
        task_description: taskDescription,
      });
      
      expect(status).toBe(201);
      expect(error).toBeNull();
      expect(data?.session).toBeDefined();
      expect(data?.session?.start_time).toBe(startTime);
      expect(data?.session?.task_description).toBe(taskDescription);
      expect(data?.session?.user_id).toBe(currentUserId);
      expect(data?.session?.end_time).toBeNull();
    });

    it('should fail if start_time is missing', async () => {
      const { data, error, status } = await makeAuthRequest('sessions', 'post', {
        // @ts-expect-error
        start_time: undefined, 
        task_description: 'Missing start time test (JWT)',
      });
      expect(status).toBe(400);
      expect(error?.value.error).toBeDefined();
    });
    
    it('should prevent creating a new session if one is already active', async () => {
        // Assumes the first test successfully created an active session.
        const startTime2 = new Date().toISOString();
        const taskDescription2 = 'Attempt to create second active session (JWT)';
        const { data, error, status } = await makeAuthRequest('sessions', 'post', {
            start_time: startTime2,
            task_description: taskDescription2,
        });
        expect(status).toBe(409);
        expect(error?.value.error).toBe('An active session already exists for this user.');
    });
  });

  describe('PUT /api/sessions/:id', () => {
    let createdSessionId: number;

    beforeAll(async () => {
      // End any existing active session from previous tests
      const active: any = await makeAuthRequest('sessions/active', 'get');
      if (active.data?.session?.id) {
          await makeAuthRequestWithParam(api.api.sessions, active.data.session.id.toString(), 'put', {
              end_time: new Date().toISOString(),
              duration_minutes: 1,
          });
      }
      
      // Create a session to be updated
      const startTime = new Date().toISOString();
      const createResponse: any = await makeAuthRequest('sessions', 'post', {
        start_time: startTime,
        task_description: 'Session to be updated (JWT)',
      });
      if (!createResponse.data?.session?.id) throw new Error("Failed to create session for PUT tests (JWT)");
      createdSessionId = createResponse.data.session.id;
    });

    it('should update an existing session successfully', async () => {
      const newEndTime = new Date().toISOString();
      const newDuration = 30;
      const newTaskDescription = 'Updated task description (JWT)';
      const newPomodoros = 2;

      const { data, error, status } = await makeAuthRequestWithParam(api.api.sessions, createdSessionId.toString(), 'put', {
        end_time: newEndTime,
        duration_minutes: newDuration,
        task_description: newTaskDescription,
        pomodoro_cycles: newPomodoros,
      });

      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.session).toBeDefined();
      expect(data?.session?.id).toBe(createdSessionId);
      expect(data?.session?.end_time).toBe(newEndTime);
      expect(data?.session?.duration_minutes).toBe(newDuration);
      expect(data?.session?.task_description).toBe(newTaskDescription);
      expect(data?.session?.pomodoro_cycles).toBe(newPomodoros);
    });

    it('should fail to update a non-existent session', async () => {
      const nonExistentId = 999999;
      const { data, error, status } = await makeAuthRequestWithParam(api.api.sessions, nonExistentId.toString(), 'put', {
        task_description: 'Attempt to update non-existent (JWT)',
      });
      expect(status).toBe(404);
      expect(error?.value.error).toBe('Study session not found or access denied');
    });
  });

  describe('GET /api/sessions/active', () => {
    beforeAll(async () => {
        const active: any = await makeAuthRequest('sessions/active', 'get');
        if (active.data?.session?.id) {
            await makeAuthRequestWithParam(api.api.sessions, active.data.session.id.toString(), 'put', {
                end_time: new Date().toISOString(),
                duration_minutes: 1,
            });
        }
    });

    it('should return null if no active session exists', async () => {
      const { data, error, status } = await makeAuthRequest('sessions/active', 'get');
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.session).toBeNull();
    });

    it('should retrieve an active session if one exists', async () => {
      const startTime = new Date().toISOString();
      await makeAuthRequest('sessions', 'post', { start_time: startTime, task_description: 'Active session test (JWT)' });

      const { data, error, status } = await makeAuthRequest('sessions/active', 'get');
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.session).toBeDefined();
      expect(data?.session?.end_time).toBeNull();
      expect(data?.session?.task_description).toBe('Active session test (JWT)');
    });
  });

  describe('GET /api/sessions', () => {
    beforeAll(async () => {
        const active: any = await makeAuthRequest('sessions/active', 'get');
        if (active.data?.session?.id) {
            await makeAuthRequestWithParam(api.api.sessions, active.data.session.id.toString(), 'put', {
                end_time: new Date().toISOString(),
                duration_minutes: 10,
                pomodoro_cycles: 1,
            });
        }
        const sTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const eTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const createResp: any = await makeAuthRequest('sessions', 'post', { start_time: sTime, task_description: 'Historical session 1 (JWT)'});
        if(createResp.data?.session?.id) {
            await makeAuthRequestWithParam(api.api.sessions, createResp.data.session.id.toString(), 'put', {
                end_time: eTime,
                duration_minutes: 60,
                pomodoro_cycles: 2,
            });
        } else {
            console.error("Failed to create historical session for GET /api/sessions test (JWT)");
        }
    });
    
    it('should retrieve a list of study sessions', async () => {
      const { data, error, status } = await makeAuthRequest('sessions', 'get');
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.sessions).toBeInstanceOf(Array);
      expect(data?.sessions?.length).toBeGreaterThanOrEqual(1);
      if(data?.sessions && data.sessions.length > 0) {
        expect(data.sessions[0].user_id).toBe(currentUserId);
      }
    });
  });
});

// Remember to add "test": "NODE_ENV=test bun test" to package.json scripts
// And ensure test_db.sqlite is gitignored.
