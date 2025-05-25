import { Elysia, t } from "elysia";
import db from './db'; // Assuming db.ts is in the same directory

const app = new Elysia()
  .decorate('db', db)
  .group('/auth', (group) =>
    group
      .post('/register', async ({ db, body, set }) => {
        const { username, password } = body;

        if (!username || !password) {
          set.status = 400;
          return { error: 'Username and password are required' };
        }

        // Check if username already exists
        const existingUserQuery = db.query('SELECT * FROM users WHERE username = ?');
        const existingUser = existingUserQuery.get(username);
        
        if (existingUser) {
          set.status = 409; // Conflict
          return { error: 'Username already taken' };
        }

        const passwordHash = await Bun.password.hash(password);
        
        try {
          db.run('INSERT INTO users (username, passwordHash) VALUES (?, ?)', [username, passwordHash]);
          set.status = 201; // Created
          return { message: 'User registered successfully' };
        } catch (error) {
          console.error('Registration error:', error);
          set.status = 500;
          return { error: 'An error occurred during registration' };
        }
      }, {
        body: t.Object({
          username: t.String(),
          password: t.String(),
        }),
      })
      .post('/login', async ({ db, body, set, cookie: { session_id } }) => { // Elysia automatically parses and provides cookies
        const { username, password } = body;

        if (!username || !password) {
          set.status = 400;
          return { error: 'Username and password are required' };
        }

        const userQuery = db.query('SELECT * FROM users WHERE username = ?');
        const user = userQuery.get(username) as { id: number; username: string; passwordHash: string } | null;

        if (!user) {
          set.status = 401; // Unauthorized
          return { error: 'Invalid username or password' };
        }

        const isPasswordValid = await Bun.password.verify(password, user.passwordHash);

        if (!isPasswordValid) {
          set.status = 401; // Unauthorized
          return { error: 'Invalid username or password' };
        }

        // Simple in-memory session store (replace with a proper session store in production)
        const sessionId = crypto.randomUUID();
        // @ts-ignore
        if (!app.decorator.sessions) {
            // @ts-ignore
            app.decorate('sessions', {});
        }
        // @ts-ignore
        app.decorator.sessions[sessionId] = { userId: user.id, username: user.username };
        
        session_id.set({ // Set the cookie
          value: sessionId,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
          path: '/',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return { message: 'Login successful', user: { id: user.id, username: user.username } };
      }, {
        body: t.Object({
          username: t.String(),
          password: t.String(),
        }),
      })
      .post('/logout', ({ cookie: { session_id }, set }) => {
        // @ts-ignore
        if (app.decorator.sessions && session_id.value && app.decorator.sessions[session_id.value]) {
            // @ts-ignore
            delete app.decorator.sessions[session_id.value];
        }
        session_id.remove(); // Clear the cookie
        return { message: 'Logout successful' };
      })
      .derive(({ cookie: { session_id } }) => { // Middleware to derive user from session
        // @ts-ignore
        const session = app.decorator.sessions && session_id.value ? app.decorator.sessions[session_id.value] : null;
        return {
          currentUser: session ? { id: session.userId, username: session.username } : null,
        };
      })
      .get('/me', ({ currentUser, set }) => {
        if (!currentUser) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        return { user: currentUser };
      })
  )
  .group('/api', (group) =>
    group
      .guard({ // Protect all routes in this group
        beforeHandle: ({ currentUser, set }) => {
          if (!currentUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
          }
        }
      })
      .post('/sessions', async ({ db, body, currentUser, set }) => {
        const { start_time, task_description } = body as { start_time: string; task_description?: string };
        const userId = currentUser!.id; // currentUser is guaranteed by the guard

        if (!start_time) {
          set.status = 400;
          return { error: 'start_time is required' };
        }

        // Optional: Check for an existing active session for this user
        const existingActiveSessionQuery = db.query(
          'SELECT * FROM study_sessions WHERE user_id = ? AND end_time IS NULL'
        );
        const existingActiveSession = existingActiveSessionQuery.get(userId);
        if (existingActiveSession) {
          set.status = 409; // Conflict
          return { error: 'An active session already exists for this user.', session: existingActiveSession };
        }
        
        try {
          const insertQuery = db.query(
            'INSERT INTO study_sessions (user_id, start_time, task_description, pomodoro_cycles, duration_minutes) VALUES (?, ?, ?, 0, 0) RETURNING *'
          );
          const newSession = insertQuery.get(userId, start_time, task_description || null);
          set.status = 201;
          return { session: newSession };
        } catch (e: any) {
          console.error('Failed to create session:', e.message);
          set.status = 500;
          return { error: 'Failed to create study session' };
        }
      }, {
        body: t.Object({
          start_time: t.String({ format: 'date-time' }),
          task_description: t.Optional(t.String()),
        }),
      })
      .put('/sessions/:id', async ({ db, params, body, currentUser, set }) => {
        const sessionId = parseInt(params.id);
        const userId = currentUser!.id;
        const { end_time, duration_minutes, task_description, pomodoro_cycles } = body as { 
          end_time?: string; 
          duration_minutes?: number; 
          task_description?: string;
          pomodoro_cycles?: number;
        };

        if (isNaN(sessionId)) {
          set.status = 400;
          return { error: 'Invalid session ID' };
        }

        // Verify session exists and belongs to the user
        const sessionQuery = db.query('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?');
        const session = sessionQuery.get(sessionId, userId) as { id: number; user_id: number; end_time: string | null } | null;

        if (!session) {
          set.status = 404;
          return { error: 'Study session not found or access denied' };
        }

        // Prevent updates if session has already ended (optional, depends on desired logic)
        // if (session.end_time) {
        //   set.status = 403;
        //   return { error: 'Cannot update an already completed session' };
        // }

        const updates: Record<string, any> = {};
        if (end_time !== undefined) updates.end_time = end_time;
        if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
        if (task_description !== undefined) updates.task_description = task_description;
        if (pomodoro_cycles !== undefined) updates.pomodoro_cycles = pomodoro_cycles;

        if (Object.keys(updates).length === 0) {
          set.status = 400;
          return { error: 'No update fields provided' };
        }

        const updateClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(updates);

        try {
          const updateQuery = db.query(
            `UPDATE study_sessions SET ${updateClauses} WHERE id = ? AND user_id = ? RETURNING *`
          );
          const updatedSession = updateQuery.get(...updateValues, sessionId, userId);
          return { session: updatedSession };
        } catch (e: any) {
          console.error('Failed to update session:', e.message);
          set.status = 500;
          return { error: 'Failed to update study session' };
        }
      }, {
        params: t.Object({ id: t.Numeric() }),
        body: t.Object({
          end_time: t.Optional(t.String({ format: 'date-time' })),
          duration_minutes: t.Optional(t.Number()),
          task_description: t.Optional(t.String()),
          pomodoro_cycles: t.Optional(t.Number()),
        }),
      })
      .get('/sessions/active', async ({ db, currentUser, set }) => {
        const userId = currentUser!.id;
        try {
          const activeSessionQuery = db.query(
            'SELECT * FROM study_sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1'
          );
          const activeSession = activeSessionQuery.get(userId);
          if (!activeSession) {
            // It's not an error to not have an active session.
            // Return null or an empty object, or a specific status if preferred.
            return { session: null }; 
          }
          return { session: activeSession };
        } catch (e: any) {
          console.error('Failed to get active session:', e.message);
          set.status = 500;
          return { error: 'Failed to retrieve active study session' };
        }
      })
      .get('/sessions', async ({ db, currentUser, set }) => {
        const userId = currentUser!.id;
        try {
          const sessionsQuery = db.query(
            'SELECT * FROM study_sessions WHERE user_id = ? ORDER BY start_time DESC'
          );
          const sessions = sessionsQuery.all(userId);
          return { sessions };
        } catch (e: any) {
          console.error('Failed to list sessions:', e.message);
          set.status = 500;
          return { error: 'Failed to retrieve study sessions' };
        }
      })
  )
  .onError(({ code, error, set }) => { // Global error handler
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return 'Not Found :(';
    }
    // Handle other errors or log them
    console.error(error);
    set.status = 500;
    return { error: 'Internal Server Error' };
  })
  .get("/", () => "Hello Elysia")

// Only listen if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(3000);
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}

export default app; // Export app for testing
