export interface SessionData {
  id: number;
  user_id: number;
  start_time: string; // ISO 8601 format
  end_time?: string | null; // ISO 8601 format, nullable for active sessions
  duration_minutes?: number;
  task_description?: string | null;
  pomodoro_cycles?: number;
}

const API_BASE_URL = '/api'; // Assuming Vite proxy is set up or same origin

// Helper for fetch requests
async function fetchApi(url: string, options: RequestInit = {}): Promise<any> {
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      // Cookies should be sent automatically by the browser if backend is on the same origin
      // or if CORS is properly configured with credentials.
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed with status: ' + response.status }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function createSession(startTime: string, taskDescription?: string): Promise<{ session: SessionData }> {
  return fetchApi(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ start_time: startTime, task_description: taskDescription }),
  });
}

export async function updateSession(sessionId: number, data: Partial<Pick<SessionData, 'end_time' | 'duration_minutes' | 'task_description' | 'pomodoro_cycles'>>): Promise<{ session: SessionData }> {
  return fetchApi(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getActiveSession(): Promise<{ session: SessionData | null }> {
  return fetchApi(`${API_BASE_URL}/sessions/active`, {
    method: 'GET',
  });
}

export async function listSessions(): Promise<{ sessions: SessionData[] }> {
  return fetchApi(`${API_BASE_URL}/sessions`, {
    method: 'GET',
  });
}
