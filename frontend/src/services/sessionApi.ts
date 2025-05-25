export interface SessionData {
  id: number;
  user_id: number;
  start_time: string; // ISO 8601 format
  end_time?: string | null; // ISO 8601 format, nullable for active sessions
  duration_minutes?: number;
  task_description?: string | null;
  pomodoro_cycles?: number;
}

const API_BASE_URL = ''; // Use relative paths for API calls, assuming same origin or proxy handles it.
                        // For this project, /auth and /api are top-level paths.

// --- User Authentication Types (mirroring backend responses) ---
export interface AuthResponse {
  message: string;
  token?: string; // Present on successful login/registration
  user?: {
    id: number;
    username: string;
  };
}

export interface User {
  id: number;
  username: string;
}

export interface MeResponse {
  user: User | null;
  error?: string;
}


// Helper for fetch requests - now includes JWT handling
async function fetchApi(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('jwtToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized - potentially token expired or invalid
      console.warn('API request Unauthorized (401). Clearing token.');
      localStorage.removeItem('jwtToken');
      // Consider dispatching a global event or using a callback to notify App to update auth state
      // For now, App.tsx will re-verify with /auth/me on next load or if it catches error.
      // Or, more proactively: window.dispatchEvent(new Event('auth-error-401'));
    }
    const errorData = await response.json().catch(() => ({ error: 'Request failed with status: ' + response.status, details: response.statusText }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status} - ${errorData.details || 'No details'}`);
  }
  // Handle cases where response might be empty (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return response.text().then(text => text ? { message: text } : {}); // Return text as message or empty obj
  }
}

// --- Authentication API Functions ---
export async function registerUser(username: string, password: string):Promise<AuthResponse> {
    const response = await fetchApi('/auth/register', { // Adjusted URL to be relative
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    if (response.token) {
        localStorage.setItem('jwtToken', response.token);
    }
    return response;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
    const response = await fetchApi('/auth/login', { // Adjusted URL
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    if (response.token) {
        localStorage.setItem('jwtToken', response.token);
    }
    return response;
}

export async function logoutUser(): Promise<{ message: string }> {
    const response = await fetchApi('/auth/logout', { method: 'POST' }); // Adjusted URL
    localStorage.removeItem('jwtToken'); // Primary action for JWT client-side logout
    return response;
}

export async function getCurrentUser(): Promise<MeResponse> {
    // This function now relies on the Authorization header being set by fetchApi
    return fetchApi('/auth/me', { method: 'GET' }); // Adjusted URL
}


// --- Study Session API Functions (remain largely the same, but will use new fetchApi) ---
export async function createSession(startTime: string, taskDescription?: string): Promise<{ session: SessionData }> {
  return fetchApi(`/api/sessions`, { // Ensure /api prefix is correct based on backend routes
    method: 'POST',
    body: JSON.stringify({ start_time: startTime, task_description: taskDescription }),
  });
}

export async function updateSession(sessionId: number, data: Partial<Pick<SessionData, 'end_time' | 'duration_minutes' | 'task_description' | 'pomodoro_cycles'>>): Promise<{ session: SessionData }> {
  return fetchApi(`/api/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getActiveSession(): Promise<{ session: SessionData | null }> {
  return fetchApi(`/api/sessions/active`, {
    method: 'GET',
  });
}

export async function listSessions(): Promise<{ sessions: SessionData[] }> {
  return fetchApi(`/api/sessions`, {
    method: 'GET',
  });
}
