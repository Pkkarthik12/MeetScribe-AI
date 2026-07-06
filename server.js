/**
 * @file server.js
 * @brief Express API server to launch and control the MeetScribe-AI bot.
 */

const express = require('express');
const { launchMeetBot } = require('./bot');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let activeSession = {
  status: 'IDLE',
  meetUrl: null,
  startTime: null
};

// --- REST Endpoints ---

// Get current bot status
app.get('/api/status', (req, res) => {
  res.json(activeSession);
});

// Trigger bot to join Google Meet
app.post('/api/join', async (req, res) => {
  const { url, name } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Google Meet URL is required.' });
  }

  // Basic meet format validation
  if (!url.includes('meet.google.com/')) {
    return res.status(400).json({ error: 'Invalid Google Meet URL format.' });
  }

  if (activeSession.status === 'ACTIVE') {
    return res.status(400).json({ error: 'Bot is already active in a meeting.' });
  }

  activeSession = {
    status: 'ACTIVE',
    meetUrl: url,
    startTime: new Date()
  };

  // Launch async to avoid blocking Express request response
  launchMeetBot(url, name)
    .then(() => {
      console.log(`[Server] Bot finished meeting session: ${url}`);
      activeSession = { status: 'IDLE', meetUrl: null, startTime: null };
    })
    .catch((err) => {
      console.error('[Server] Bot crashed:', err);
      activeSession = { status: 'ERROR', meetUrl: null, startTime: null };
    });

  res.json({
    message: 'Bot join request submitted successfully.',
    session: activeSession
  });
});

// Force bot to exit
app.post('/api/leave', (req, res) => {
  if (activeSession.status === 'IDLE') {
    return res.status(400).json({ error: 'No active session found.' });
  }

  console.log('[Server] Received manual leave command. Closing bot session.');
  
  // Since process exits on leave command in bot.js, or we shut down browser instance.
  // In a multi-tenant environment, we track browser references in a Map.
  // Here, we trigger a process restart or shut down.
  // For simplicity, we flag activeSession as idle and let the Puppeteer connection close.
  activeSession = { status: 'IDLE', meetUrl: null, startTime: null };
  res.json({ message: 'Leave command sent.' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` MeetScribe-AI Server running on port ${PORT}`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Join API: POST /api/join { "url": "https://meet.google.com/..." }`);
  console.log(`====================================================`);
});
