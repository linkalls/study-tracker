import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { edenTreaty } from '@elysiajs/eden';
import app from './index'; // Your main Elysia app

const TestApp = app; // Use the imported app directly
const api = edenTreaty<typeof TestApp>('http://localhost:3000'); // Base client

// Helper function to get an authenticated API client instance
async function getAuthenticatedClient() {
  const uniqueUserSuffix = Date.now();
  const username = `test_session_user_${uniqueUserSuffix}`;
  const password = 'password123';

  // Register user
  const regResponse = await api.auth.register.post({ username, password });
  if (regResponse.status !== 201) {
    console.error('Registration failed in test setup:', regResponse.error, regResponse.data);
    throw new Error('Test setup: User registration failed');
  }

  // Login user to get cookies stored in this specific eden client instance
  const loginResponse = await api.auth.login.post({ username, password });
  if (loginResponse.status !== 200 || !loginResponse.cookie?.session_id?.value) {
    console.error('Login failed in test setup:', loginResponse.error, loginResponse.data);
    throw new Error('Test setup: User login failed or no cookie received');
  }
  // This 'api' instance now holds the session cookie from the login
  return api; 
}


describe('Study Session Endpoints', () => {
  let authenticatedApi: typeof api;
  let userId: number; // Assuming user ID is needed for some assertions, though not directly used in API calls here

  beforeAll(async () => {
    authenticatedApi = await getAuthenticatedClient();
    // Optionally, get user details if needed for assertions (e.g. to verify user_id in session data)
    const meResponse = await authenticatedApi.auth.me.get();
    if (meResponse.data?.user?.id) {
      userId = meResponse.data.user.id;
    } else {
      throw new Error("Test setup: Could not retrieve authenticated user's ID.");
    }
  });

  describe('POST /api/sessions', () => {
    it('should create a new study session successfully', async () => {
      const startTime = new Date().toISOString();
      const taskDescription = 'Test task for new session';

      const { data, error, status } = await authenticatedApi.api.sessions.post({
        start_time: startTime,
        task_description: taskDescription,
      });
      
      expect(status).toBe(201);
      expect(error).toBeNull();
      expect(data?.session).toBeDefined();
      expect(data?.session?.start_time).toBe(startTime);
      expect(data?.session?.task_description).toBe(taskDescription);
      expect(data?.session?.user_id).toBe(userId); // Verify user_id
      expect(data?.session?.end_time).toBeNull();
    });

    it('should fail if start_time is missing', async () => {
      const { data, error, status } = await authenticatedApi.api.sessions.post({
        // @ts-expect-error
        start_time: undefined, 
        task_description: 'Missing start time test',
      });
      expect(status).toBe(400); // Based on Elysia's default validation or custom handler
      expect(error?.value.error).toBeDefined();
    });
    
    it('should prevent creating a new session if one is already active', async () => {
        // First session (created in the first test or create one here if tests are isolated)
        // To ensure isolation, let's create a session here if none from previous test is assumed.
        // If the first test in this describe block already created one, this test might depend on its success.
        // For true isolation, each 'it' block should set up its own specific state.
        // Let's assume the first test was successful and an active session exists.
        const startTime2 = new Date().toISOString();
        const taskDescription2 = 'Attempt to create second active session';
        const { data, error, status } = await authenticatedApi.api.sessions.post({
            start_time: startTime2,
            task_description: taskDescription2,
        });
        expect(status).toBe(409); // Conflict
        expect(error?.value.error).toBe('An active session already exists for this user.');
    });
  });

  describe('PUT /api/sessions/:id', () => {
    let createdSessionId: number;

    beforeAll(async () => {
      // End any existing active session from previous tests to allow creating a new one.
      const active = await authenticatedApi.api.sessions.active.get();
      if (active.data?.session?.id) {
          await authenticatedApi.api.sessions(active.data.session.id.toString()).put({
              end_time: new Date().toISOString(),
              duration_minutes: 1, // dummy duration
          });
      }
      
      // Create a session to be updated
      const startTime = new Date().toISOString();
      const createResponse = await authenticatedApi.api.sessions.post({
        start_time: startTime,
        task_description: 'Session to be updated',
      });
      if (!createResponse.data?.session?.id) throw new Error("Failed to create session for PUT tests");
      createdSessionId = createResponse.data.session.id;
    });

    it('should update an existing session successfully', async () => {
      const newEndTime = new Date().toISOString();
      const newDuration = 30;
      const newTaskDescription = 'Updated task description';
      const newPomodoros = 2;

      const { data, error, status } = await authenticatedApi.api.sessions(createdSessionId.toString()).put({
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
      const { data, error, status } = await authenticatedApi.api.sessions(nonExistentId.toString()).put({
        task_description: 'Attempt to update non-existent',
      });
      expect(status).toBe(404);
      expect(error?.value.error).toBe('Study session not found or access denied');
    });
    
    // Test for updating a session not owned by the user would require a second authenticated user.
    // This setup is more complex and might be skipped for brevity unless critical.
  });

  describe('GET /api/sessions/active', () => {
    beforeAll(async () => {
        // Ensure no active sessions before this block by ending any previous one
        const active = await authenticatedApi.api.sessions.active.get();
        if (active.data?.session?.id) {
            await authenticatedApi.api.sessions(active.data.session.id.toString()).put({
                end_time: new Date().toISOString(),
                duration_minutes: 1,
            });
        }
    });

    it('should return null if no active session exists', async () => {
      const { data, error, status } = await authenticatedApi.api.sessions.active.get();
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.session).toBeNull();
    });

    it('should retrieve an active session if one exists', async () => {
      // Create an active session
      const startTime = new Date().toISOString();
      await authenticatedApi.api.sessions.post({ start_time: startTime, task_description: 'Active session test' });

      const { data, error, status } = await authenticatedApi.api.sessions.active.get();
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.session).toBeDefined();
      expect(data?.session?.end_time).toBeNull();
      expect(data?.session?.task_description).toBe('Active session test');
    });
  });

  describe('GET /api/sessions', () => {
    beforeAll(async () => {
        // Ensure at least one completed session exists for the list
        // End the active session from the previous test
        const active = await authenticatedApi.api.sessions.active.get();
        if (active.data?.session?.id) {
            await authenticatedApi.api.sessions(active.data.session.id.toString()).put({
                end_time: new Date().toISOString(),
                duration_minutes: 10,
                pomodoro_cycles: 1,
            });
        }
        // Create another session and complete it to ensure there's something in the list
        const sTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
        const eTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
        const createResp = await authenticatedApi.api.sessions.post({ start_time: sTime, task_description: 'Historical session 1'});
        if(createResp.data?.session?.id) {
            await authenticatedApi.api.sessions(createResp.data.session.id.toString()).put({
                end_time: eTime,
                duration_minutes: 60,
                pomodoro_cycles: 2,
            });
        } else {
            console.error("Failed to create historical session for GET /api/sessions test");
        }
    });
    
    it('should retrieve a list of study sessions', async () => {
      const { data, error, status } = await authenticatedApi.api.sessions.get();
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data?.sessions).toBeInstanceOf(Array);
      expect(data?.sessions?.length).toBeGreaterThanOrEqual(1); // Based on setup
      if(data?.sessions && data.sessions.length > 0) {
        expect(data.sessions[0].user_id).toBe(userId);
      }
    });

    // Test for an empty list of sessions would require a new user with no sessions.
  });
});

// Remember to add "test": "NODE_ENV=test bun test" to package.json scripts
// And ensure test_db.sqlite is gitignored.
