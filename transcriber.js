/**
 * @file transcriber.js
 * @brief Integration module for taking raw transcription logs and passing
 * them to the Google Gemini API to generate structured meeting summaries.
 */

const https = require('https');
require('dotenv').config();

// Mocks transcription processing (Deepgram/Whisper) and invokes Gemini LLM
async function processMeetingNotes(rawTranscriptSegments) {
  // Combine transcript segments: [{ speaker: "Alice", text: "Hi" }, ...]
  const fullTranscript = rawTranscriptSegments
    .map(seg => `${seg.speaker || 'Participant'}: ${seg.text}`)
    .join('\n');

  console.log(`[Transcriber] Sending ${rawTranscriptSegments.length} segments to Gemini AI...`);

  // Gemini API details
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.warn('[Transcriber] Warning: GEMINI_API_KEY is not defined in environment.');
    return mockSummary(fullTranscript);
  }

  // Define structured summarization prompt
  const systemPrompt = `You are a professional corporate secretary. Summarize the following meeting transcript.
Your output must be in Markdown and contain:
1. Executive Summary: High-level overview of the meeting.
2. Decisions Made: Bulleted list of key decisions.
3. Action Items: Clear list of who is doing what, with deadlines if discussed.
4. Detailed Transcript Outline: Grouped by main topics.`;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { text: systemPrompt },
        { text: `Meeting Transcript:\n${fullTranscript}` }
      ]
    }]
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.candidates && json.candidates[0].content.parts[0].text) {
            resolve(json.candidates[0].content.parts[0].text);
          } else {
            reject(new Error(`Invalid API Response: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function mockSummary(transcriptText) {
  console.log('[Transcriber] Local mockup compiler invoked.');
  return `
# 📝 Meeting Notes Summary (Gemini API Offline)

## Executive Summary
This is a local fallback summary generated because the \`GEMINI_API_KEY\` was not configured. 

## Original Transcript Log
\`\`\`text
${transcriptText}
\`\`\`
  `;
}

module.exports = { processMeetingNotes };
