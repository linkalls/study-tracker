import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { edenTreaty } from '@elysiajs/eden';
import app from './index'; // Your main Elysia app
import db from './db'; // Import db to manipulate data for tests

const TestApp = app;
const api = edenTreaty<typeof TestApp>('http://localhost:3000');

// Helper to create users and sessions
async function setupTestData() {
  // Clear existing data to ensure clean slate for ranking tests
  db.run('DELETE FROM study_sessions');
  db.run('DELETE FROM users');
  db.run('DELETE FROM sqlite_sequence WHERE name="users"'); // Reset autoincrement for users
  db.run('DELETE FROM sqlite_sequence WHERE name="study_sessions"'); // Reset autoincrement for sessions


  const users = [
    { username: 'user_rank1', password: 'p1' }, // Highest total time
    { username: 'user_rank2', password: 'p2' }, // Middle
    { username: 'user_rank3', password: 'p3' }, // Lowest
    { username: 'user_no_sessions', password: 'p4'}, // No sessions
  ];

  const userIds: { [key: string]: number } = {};

  for (const user of users) {
    const passwordHash = await Bun.password.hash(user.password);
    const result = db.query('INSERT INTO users (username, passwordHash) VALUES (?, ?) RETURNING id').get(user.username, passwordHash) as { id: number };
    if (result && result.id) {
      userIds[user.username] = result.id;
    } else {
      console.error(`Failed to get ID for user ${user.username}`);
    }
  }
  
  // Check if userIds were populated
  if (Object.keys(userIds).length !== users.length) {
      console.error("User ID population failed. Current userIds:", userIds);
      throw new Error("Test setup: Failed to create all users or retrieve their IDs.");
  }


  const sessions = [
    // User1: Total 150 mins
    { userId: userIds['user_rank1'], duration_minutes: 60, task_description: 'Task A1', start_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), end_time: new Date().toISOString(), pomodoro_cycles: 2 },
    { userId: userIds['user_rank1'], duration_minutes: 90, task_description: 'Task A2', start_time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), end_time: new Date().toISOString(), pomodoro_cycles: 3 },
    // User2: Total 100 mins
    { userId: userIds['user_rank2'], duration_minutes: 100, task_description: 'Task B1', start_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), end_time: new Date().toISOString(), pomodoro_cycles: 4 },
    // User3: Total 50 mins
    { userId: userIds['user_rank3'], duration_minutes: 50, task_description: 'Task C1', start_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), end_time: new Date().toISOString(), pomodoro_cycles: 1 },
    // Session with 0 duration for user_rank1 (should be ignored)
    { userId: userIds['user_rank1'], duration_minutes: 0, task_description: 'Task A3 - Zero Duration', start_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), end_time: new Date().toISOString(), pomodoro_cycles: 0 },
    // Session with null end_time for user_rank2 (active, should be ignored)
    { userId: userIds['user_rank2'], duration_minutes: 120, task_description: 'Task B2 - Active', start_time: new Date().toISOString(), end_time: null, pomodoro_cycles: 0 },
  ];

  const insertSession = db.prepare(
    'INSERT INTO study_sessions (user_id, start_time, end_time, duration_minutes, task_description, pomodoro_cycles) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertManySessions = db.transaction((sessBatch) => {
    for (const sess of sessBatch) {
        if (!sess.userId) {
            console.error("Attempted to insert session with undefined userId:", sess);
            continue; // Skip if userId is undefined
        }
      insertSession.run(sess.userId, sess.start_time, sess.end_time, sess.duration_minutes, sess.task_description, sess.pomodoro_cycles);
    }
    return sessBatch.length;
  });

  insertManySessions(sessions.filter(s => s.userId !== undefined)); // Filter out sessions with undefined userId just in case
}

describe('/api/rankings Endpoint', () => {
  beforeAll(async () => {
    await setupTestData();
  });

  it('should return a successful response (status 200)', async () => {
    const { status } = await api.api.rankings.get();
    expect(status).toBe(200);
  });

  it('should return an array for rankings', async () => {
    const { data } = await api.api.rankings.get();
    expect(data?.rankings).toBeInstanceOf(Array);
  });

  it('should return users sorted by total_study_minutes descending', async () => {
    const { data } = await api.api.rankings.get();
    const rankings = data?.rankings;

    expect(rankings).toBeDefined();
    if (!rankings) return; // Type guard

    // Expected order: user_rank1 (150), user_rank2 (100), user_rank3 (50)
    // user_no_sessions should not appear.
    // Sessions with 0 duration or null end_time should be ignored.
    expect(rankings.length).toBe(3); // Only 3 users have valid, completed sessions
    
    expect(rankings[0].username).toBe('user_rank1');
    expect(rankings[0].total_study_minutes).toBe(150);

    expect(rankings[1].username).toBe('user_rank2');
    expect(rankings[1].total_study_minutes).toBe(100);
    
    expect(rankings[2].username).toBe('user_rank3');
    expect(rankings[2].total_study_minutes).toBe(50);

    // Check sorting
    for (let i = 0; i < rankings.length - 1; i++) {
      expect(rankings[i].total_study_minutes).toBeGreaterThanOrEqual(rankings[i + 1].total_study_minutes);
    }
  });

  it('should return objects with username and total_study_minutes', async () => {
    const { data } = await api.api.rankings.get();
    const rankings = data?.rankings;

    if (rankings && rankings.length > 0) {
      for (const item of rankings) {
        expect(item).toHaveProperty('username');
        expect(item).toHaveProperty('total_study_minutes');
        expect(typeof item.username).toBe('string');
        expect(typeof item.total_study_minutes).toBe('number');
      }
    } else {
      // If no rankings, this test passes vacuously. Could also expect length > 0 if setup guarantees data.
      // Given the setup, we expect rankings.
      expect(rankings?.length).toBeGreaterThan(0);
    }
  });

  it('should limit results to 10 by default (or less if fewer users)', async () => {
    // This test needs more than 10 users with sessions to fully verify the limit.
    // For now, we check it doesn't exceed 10.
    // The current setup has 3 users with valid sessions.
    const { data } = await api.api.rankings.get();
    expect(data?.rankings?.length).toBeLessThanOrEqual(10);
    expect(data?.rankings?.length).toBe(3); // Based on current setup
  });

  it('should return an empty list if no study sessions exist', async () => {
    // Clear sessions data
    db.run('DELETE FROM study_sessions');
    // Keep users, but they now have no sessions.
    // (user_no_sessions already has no sessions)
    
    const { data, status } = await api.api.rankings.get();
    expect(status).toBe(200);
    expect(data?.rankings).toBeInstanceOf(Array);
    expect(data?.rankings?.length).toBe(0);

    // Restore data for any subsequent tests within this describe block if needed,
    // though typically tests should be isolated or run in a specific order.
    // For simplicity, this test is last or assumes no other tests depend on the populated state after it.
    // Or, ideally, use afterEach to clean up / re-seed.
    // For this subtask, let's re-run setupTestData if we had more tests.
    // For now, this is the last test of this suite.
  });
});
