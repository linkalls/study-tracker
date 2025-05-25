# FocusFlow: Study & Pomodoro Timer Application

## 1. Project Overview

FocusFlow is a full-stack web application designed to help users enhance their productivity through focused study sessions using the Pomodoro Technique. It allows users to register, log in, manage study tasks, utilize a configurable Pomodoro timer, and track their study history.

**Key Technologies:**

*   **Backend:** Bun, Elysia.js (a fast, and type-safe Bun REST API framework)
*   **Frontend:** React (with Vite), TypeScript
*   **Styling:** Tailwind CSS
*   **Database:** SQLite (via `bun:sqlite`)
*   **Testing:** `bun:test` (backend), Vitest & React Testing Library (frontend)

## 2. Getting Started / Setup

Follow these instructions to get the FocusFlow application running on your local machine.

### Prerequisites

*   **Bun:** Ensure you have Bun installed. You can find installation instructions at [bun.sh](https://bun.sh/).

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install Backend Dependencies:**
    From the project root directory:
    ```bash
    bun install
    ```
    This will install Elysia, SQLite driver, and other necessary backend packages.

3.  **Install Frontend Dependencies:**
    Navigate to the `frontend` directory and install its dependencies:
    ```bash
    cd frontend
    bun install
    ```
    This will install React, Vite, Tailwind CSS, and other frontend packages.

### Running the Application

1.  **Run the Backend Server:**
    From the project **root directory**:
    ```bash
    bun run index.ts 
    ```
    (Or, if you have a `dev` script in your root `package.json` like `bun run dev`, use that.)
    The backend server will typically start on `http://localhost:3000`. This is also where the API is served.

2.  **Run the Frontend Development Server:**
    From the **`frontend` directory**:
    ```bash
    bun run dev
    ```
    The frontend development server (Vite) will usually start on `http://localhost:5173` (or the next available port). Open this URL in your browser to use the application.

### Running with Docker Compose

Alternatively, you can run the entire application using Docker Compose.

**Prerequisites:**

*   **Docker:** Ensure Docker is installed. ([Get Docker](https://www.docker.com/get-started))
*   **Docker Compose:** Ensure Docker Compose is installed (usually included with Docker Desktop).

**Commands:**

1.  **Build and Start Services:**
    From the project **root directory** (where `docker-compose.yml` is located):
    ```bash
    docker-compose up --build -d
    ```
    The `-d` flag runs the containers in detached mode (in the background).

2.  **Accessing the Application:**
    *   **Frontend:** Open your browser and navigate to `http://localhost:8080`.
    *   **Backend API:** The API will be accessible at `http://localhost:3001`.

3.  **Viewing Logs:**
    To view the logs for a specific service:
    ```bash
    docker-compose logs -f backend
    ```
    Or for the frontend:
    ```bash
    docker-compose logs -f frontend
    ```
    The `-f` flag follows the log output.

4.  **Stopping Services:**
    To stop and remove the containers:
    ```bash
    docker-compose down
    ```

## 3. Features and Usage

### User Authentication

Authentication is token-based using JSON Web Tokens (JWT). Upon successful login or registration, a JWT is issued to the client, which then includes this token in the `Authorization` header for subsequent requests to protected resources.

*   **Register:**
    1.  Navigate to the application. If there are explicit "Register" or "Sign Up" links/pages, use them. (Note: The current UI primarily focuses on the timer after login; direct registration/login forms might need to be added or accessed via API clients for initial setup if not present in UI).
    2.  To register via API (e.g., using an API tool like Postman or Insomnia): Send a `POST` request to `/auth/register` with a JSON body:
        ```json
        {
          "username": "your_username",
          "password": "your_password"
        }
        ```
*   **Login:**
    1.  Similar to registration, use UI elements if available.
    2.  To log in via API: Send a `POST` request to `/auth/login` with a JSON body:
        ```json
        {
          "username": "your_username",
          "password": "your_password"
        }
        ```
        A successful login will set an HTTP-only session cookie.
*   **Logout:**
    1.  If a "Logout" button is available in the UI, click it.
    2.  To log out via API: Send a `POST` request to `/auth/logout`. This will clear your session.

### Pomodoro Timer

The Pomodoro Timer is designed to help you break down work into focused intervals.

*   **Timer Display:**
    *   Shows the remaining time in `MM:SS` format.
    *   Indicates the current mode (Work, Short Break, Long Break) using tab-like selectors above the timer.
*   **Controls:**
    *   **Start:** Begins or resumes the timer for the selected mode.
    *   **Pause:** Pauses the currently running timer.
    *   **Reset:** Stops the timer and resets the time to the full duration for the currently selected mode. If reset during a "Work" cycle, it may also signal the end of the current study segment to the backend.
*   **Switching Modes:**
    *   Click on the "Work", "Short Break", or "Long Break" tabs above the timer to manually switch to that mode. The timer will reset to the new mode's duration (if not already running).
*   **Timer Durations:**
    *   Default durations are:
        *   **Work:** 25 minutes
        *   **Short Break:** 5 minutes
        *   **Long Break:** 15 minutes (typically taken after 4 Pomodoro "Work" cycles)
    *   You can configure these durations using the input fields in the "Timer Settings" section below the timer controls. Changes apply when the timer is not running for the respective mode.
*   **Notifications & Sound:**
    *   At the end of each session (Work, Short Break, or Long Break), your browser will display a notification.
    *   A sound alert will also play. You might need to grant notification permissions to your browser for this site.

### Study Session Logging

This feature helps you track what you're working on and how many Pomodoro cycles you complete.

*   **Entering a Task:**
    *   In the "Study Session" section, type a description of your task into the input field (e.g., "Work on Chapter 5 of history book").
*   **Automatic Session Start:**
    *   If you have entered a task description in the "Study Session" section, starting a "Work" cycle on the Pomodoro timer will automatically create and start a new study session on the backend.
    *   If no task is entered, you might need to click "Start New Session" in the "Study Session" section first.
*   **Updating Pomodoro Count:**
    *   Each time you complete a "Work" cycle in the Pomodoro timer, the "Pomodoros completed" count for the active study session is automatically incremented.
*   **Manual Session End:**
    *   Click the "End Current Session" button in the "Study Session" section to manually stop tracking the current task. This will record the end time and total duration.
    *   Resetting the Pomodoro timer during a "Work" cycle also ends the current study segment and updates the backend session.
*   **Recorded Information:**
    *   Each study session records: your user ID, the task description, start time, end time, total duration (in minutes), and the number of Pomodoro cycles completed.

### Study History

*   **Viewing History:**
    *   The "Study History" section (typically displayed alongside or below the timer/logger) lists your past study sessions.
    *   It shows a chronological list, with the most recent sessions first.
*   **Information Displayed:**
    *   **Task Description:** What you worked on.
    *   **Start Time:** Date and time the session began.
    *   **End Time:** Date and time the session ended (or "Active" if still ongoing).
    *   **Duration:** Total time spent on the session.
    *   **Pomodoros:** Number of work cycles completed.

### Dark Mode

*   The application respects your operating system's color scheme preference for light or dark mode.
*   You can also manually enable dark mode by adding the `dark` class to the `<html>` element of the page using browser developer tools (this is a common way Tailwind CSS dark mode is often toggled via JavaScript, though a UI toggle button is not explicitly described for this app).

## 4. Running Tests

Commands to execute the automated tests:

*   **Backend Tests:**
    From the project **root directory**:
    ```bash
    NODE_ENV=test bun test
    ```
    This runs tests for the Elysia API endpoints (authentication, sessions).

*   **Frontend Tests:**
    From the **`frontend` directory**:
    ```bash
    bun test 
    ```
    (Or `bun run test` if specified in `frontend/package.json`)
    This runs component tests using Vitest and React Testing Library.
    *Note: Previous attempts by the automated worker to install frontend test dependencies faced environment issues. If these dependencies (`vitest`, `@testing-library/react`, etc.) are not installed, these tests cannot run. Ensure they are properly installed via `cd frontend && bun install` if you encounter issues.*

## 5. Project Structure

A brief overview of important directories:

*   **`/` (Root Directory):**
    *   Contains the backend Elysia application setup (`index.ts`, `db.ts`).
    *   `db.sqlite`: The SQLite database file (and `test_db.sqlite` during tests).
    *   `auth.test.ts`, `sessions.test.ts`: Backend test files.
    *   `package.json`, `bun.lockb`: Backend dependencies and scripts.
    *   `README.md`, `README.en.md`: Project documentation.
*   **`/frontend`:** Contains the React frontend application.
    *   `package.json`, `bun.lockb`: Frontend dependencies and scripts.
    *   `vite.config.ts`: Vite and Vitest configuration.
    *   **`/frontend/src`**: Source code for the React app.
        *   `main.tsx`: Main entry point for the React app.
        *   `App.tsx`: Root React component, orchestrates the UI.
        *   **`/frontend/src/components`**: Reusable React components (e.g., `PomodoroTimer.tsx`, `StudyLogger.tsx`, `StudyHistory.tsx`).
        *   **`/frontend/src/services`**: Modules for interacting with the backend API (e.g., `sessionApi.ts`).
        *   `index.css`: Global styles and Tailwind CSS directives.
        *   `setupTests.ts`: Vitest setup file.

---

Enjoy using FocusFlow to boost your productivity!
