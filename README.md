# 🤖 MeetScribe-AI

> **Autonomous Google Meet Live Note-Taking and Summarization Bot**

MeetScribe-AI is an automated agent designed to programmatically join a Google Meet room, capture session audio streams, transcribe participant discussions, and generate highly structured summaries, action items, and decisions using the **Google Gemini API**.

---

## ⚙️ Architecture & How It Works

1.  **Headless Chromium Automation:** Using **Puppeteer**, the bot logs in or joins as a guest, automatically bypasses camera/mic permissions, inputs a customizable agent name, and clicks **"Ask to join"**.
2.  **PulseAudio Loopbacks & Audio Hooks:** Once admitted, the bot hooks the WebRTC peer audio tags in the Chromium page DOM. It converts raw Float32 arrays into 16-bit PCM chunks and channels them back to Node.js.
3.  **Command Listener:** The bot continually scrapes the chat window. If any meeting attendee posts `/leave` or `/stop`, the bot automatically announces its exit and terminates the session.
4.  **AI Summarizer:** The transcript segments are compiled and sent to the **Gemini API** using a structured prompt template to output professional-grade markdown summaries.

---

## 📁 Repository Structure

```
MeetScribe-AI/
├── .github/
│   └── workflows/
│       └── build.yml       # CI build syntax verification pipeline
├── bot.js                  # Puppeteer web automation script
├── server.js               # Express API endpoints to command the bot
├── transcriber.js          # Speech-to-text hooks & Gemini AI summarization
├── Dockerfile              # Docker recipe (installs Chrome & PulseAudio virtual soundcards)
├── docker-compose.yml      # Orchestration definition
├── .gitignore
├── LICENSE                 # MIT Open Source License
└── README.md               # This documentation
```

---

## ⚡ Setup & Installation

### 1. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Local Node.js Execution
To run locally, you need a modern version of Google Chrome or Chromium installed on your host system:
```bash
# Install npm dependencies
npm install

# Start the Express API server
npm start
```

### 3. Deploy via Docker (Recommended)
Running inside Docker avoids installing Chromium dependencies manually on your host machine. Docker also spins up **PulseAudio** as a background service for virtual audio loopbacks:
```bash
# Build and run the container
docker-compose up --build -d
```

---

## 📡 REST API Documentation

### 1. Join a Meeting
Command the bot to join a target Google Meet room.
*   **URL:** `POST /api/join`
*   **Body:**
    ```json
    {
      "url": "https://meet.google.com/abc-defg-hij",
      "name": "MeetScribe Assistant"
    }
    ```
*   **Response:**
    ```json
    {
      "message": "Bot join request submitted successfully.",
      "session": {
        "status": "ACTIVE",
        "meetUrl": "https://meet.google.com/abc-defg-hij",
        "startTime": "2026-07-06T18:48:00.000Z"
      }
    }
    ```

### 2. Check Bot Status
*   **URL:** `GET /api/status`
*   **Response:**
    ```json
    {
      "status": "ACTIVE",
      "meetUrl": "https://meet.google.com/abc-defg-hij",
      "startTime": "2026-07-06T18:48:00.000Z"
    }
    ```

### 3. Dismiss the Bot
*   **URL:** `POST /api/leave`
*   **Response:**
    ```json
    {
      "message": "Leave command sent."
    }
    ```

---

## ⚖️ Legal & Compliance Notice

Recording and transcribing private conversations is subject to strict wiretapping and privacy regulations worldwide (e.g., GDPR, California All-Party Consent laws).

**To ensure compliance, MeetScribe-AI has these features built-in:**
1.  **Transparent Naming:** The bot joins as `[Custom Name] (Notetaker)` so all participants see it in the attendee grid.
2.  **Chat Announcement:** Once admitted, the bot immediately posts a message in the chat explaining its purpose, who invited it, and how to stop it.
3.  **Active Opt-Out:** Attendees can type `/leave` or `/stop` directly in the Meet chat room. The bot will parse this command and immediately close its browser tab.
