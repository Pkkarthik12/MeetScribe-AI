/**
 * @file bot.js
 * @brief core Puppeteer script to launch Chrome, bypass permissions, join
 * Google Meet as a guest, monitor chat, and hook WebRTC audio outputs.
 */

const puppeteer = require('puppeteer');
require('dotenv').config();

async function launchMeetBot(meetUrl, botName = 'MeetScribe AI (Notetaker)') {
  console.log(`[MeetScribe] Initializing browser instance for meeting: ${meetUrl}`);
  
  // Launch Chromium with specific WebRTC and media flags
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream', // Auto-approves microphone and camera permission pop-ups
      '--use-fake-device-for-media-stream', // Feeds mock static microphone and camera inputs
      '--allow-file-access-from-files',
      '--disable-gesture-requirement-for-media-playback'
    ],
    // Path to Chrome or Chromium when running in Docker
    executablePath: process.env.CHROME_BIN || null
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to Google Meet
    console.log(`[MeetScribe] Navigating to ${meetUrl}...`);
    // Append queries to turn off camera and mic before joining (helps bypass landing clicks)
    const joinUrl = meetUrl + (meetUrl.includes('?') ? '&' : '?') + 'authuser=0&hs=179';
    await page.goto(joinUrl, { waitUntil: 'networkidle2' });

    // Handle Landing Page: Turn off mic and camera (standard keystrokes Ctrl+D and Ctrl+E)
    console.log('[MeetScribe] Mutting camera and mic on landing screen...');
    await page.keyboard.down('Control');
    await page.keyboard.press('d'); // Toggle mic
    await page.keyboard.press('e'); // Toggle camera
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 2000));

    // Wait for the Guest Name Input Field
    console.log('[MeetScribe] Waiting for join prompts...');
    const nameInputSelector = 'input[type="text"]';
    await page.waitForSelector(nameInputSelector, { timeout: 15000 });
    
    // Type bot name
    console.log(`[MeetScribe] Entering bot username: "${botName}"`);
    await page.type(nameInputSelector, botName);
    await new Promise(r => setTimeout(r, 500));

    // Click "Ask to join" or "Join now"
    // Google Meet's buttons contain text spans. We can target them by matching text content.
    const buttons = await page.$$('button');
    let clicked = false;
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text.includes('Ask to join') || text.includes('Join now') || text.includes('Ask to')) {
        console.log(`[MeetScribe] Clicking join button: "${text.trim()}"`);
        await button.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.log('[MeetScribe] Fallback button selection by CSS class...');
      // Secondary fallback selector
      await page.click('button[aria-label*="join" i], button[class*="join" i]');
    }

    console.log('[MeetScribe] Requested entry. Waiting to be admitted by the host...');
    
    // Wait for the meeting DOM structure to load (indicates bot is inside the call)
    // Selector for main grid or bottom control bar
    const controlBarSelector = 'div[aria-label="Meeting controls"]';
    await page.waitForSelector(controlBarSelector, { timeout: 300000 }); // Wait up to 5 mins
    console.log('[MeetScribe] SUCCESS: Bot has entered the Google Meet room!');

    // Post intro message to Chat
    await postIntroChat(page);

    // Setup active listeners
    await setupChatMonitor(page, browser);
    await setupAudioHook(page);

  } catch (error) {
    console.error('[MeetScribe] Fatal Bot Error:', error);
    await browser.close();
  }
}

async function postIntroChat(page) {
  try {
    console.log('[MeetScribe] Sending intro message to chat panel...');
    // Click open Chat sidebar button
    const chatBtn = 'button[aria-label*="chat" i], button[data-tooltip*="chat" i]';
    await page.click(chatBtn);
    await new Promise(r => setTimeout(r, 1000));

    // Wait for chat textarea
    const chatTextArea = 'textarea[aria-label*="message" i], textarea[placeholder*="message" i]';
    await page.waitForSelector(chatTextArea);
    
    const introMsg = "Hello! I am MeetScribe AI. I have joined to take notes. Post '/leave' or '/stop' in the chat to dismiss me.";
    await page.type(chatTextArea, introMsg);
    await page.keyboard.press('Enter');
    
    console.log('[MeetScribe] Intro chat posted.');
  } catch (e) {
    console.log('[MeetScribe] Warning: Failed to send chat introduction.', e.message);
  }
}

async function setupChatMonitor(page, browser) {
  console.log('[MeetScribe] Monitoring chat panel for control commands...');
  
  // Scrape chat messages periodically
  setInterval(async () => {
    try {
      const messages = await page.evaluate(() => {
        // Collect all text containers in the chat panel
        const chatElements = document.querySelectorAll('div[data-message-text]');
        return Array.from(chatElements).map(el => el.textContent.toLowerCase().trim());
      });

      if (messages.some(msg => msg.includes('/leave') || msg.includes('/stop'))) {
        console.log('[MeetScribe] Command Received: /leave. Exiting room.');
        await browser.close();
        process.exit(0);
      }
    } catch (e) {
      // Chat closed or DOM hidden
    }
  }, 3000);
}

async function setupAudioHook(page) {
  console.log('[MeetScribe] Hooking WebRTC Audio outputs in page context...');
  
  // Expose node function so Puppeteer page context can pipe audio buffers back
  await page.exposeFunction('onAudioChunk', (base64Chunk) => {
    // Pipe this raw audio buffer to your Speech-to-Text handler (Transcriber)
    // console.log(`Received audio chunk size: ${base64Chunk.length}`);
  });

  // Inject Web Audio API listeners in the page context to capture audio elements
  await page.evaluate(() => {
    console.log("Injecting Web Audio hooks...");
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Locate WebRTC peer audio streams or audio elements
    // Meet outputs audio through HTML5 <audio> tags or direct AudioNodes
    setInterval(() => {
      const audioTags = document.querySelectorAll('audio');
      audioTags.forEach(tag => {
        if (tag.dataset.hooked) return;
        tag.dataset.hooked = 'true';
        
        console.log("Hooking HTML5 audio node:", tag);
        const source = audioCtx.createMediaElementSource(tag);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        
        source.connect(processor);
        processor.connect(audioCtx.destination);
        
        processor.onaudioprocess = (e) => {
          const inputBuffer = e.inputBuffer.getChannelData(0);
          // Convert float array to 16-bit PCM Int16Array
          const pcmVal = new Int16Array(inputBuffer.length);
          for (let i = 0; i < inputBuffer.length; i++) {
            pcmVal[i] = Math.min(1, Math.max(-1, inputBuffer[i])) * 0x7FFF;
          }
          // Send base64 back to Node process
          const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pcmVal.buffer)));
          window.onAudioChunk(base64);
        };
      });
    }, 4000);
  });
}

// Allow CLI launch
if (require.main === module) {
  const url = process.argv[2] || 'https://meet.google.com/abc-defg-hij';
  launchMeetBot(url);
}

module.exports = { launchMeetBot };
