const COMMANDS = [
  { cmd: 'docs', url: 'https://docs.google.com/document/', description: 'Google ドキュメントを開く' },
  { cmd: 'mail', url: 'https://mail.google.com/', description: 'Gmailを開く' },
  { cmd: 'mails', url: 'https://mail.google.com/', description: 'Gmailを開く' },
  { cmd: 'slides', url: 'https://docs.google.com/presentation/', description: 'Google スライドを開く' },
  { cmd: 'sheets', url: 'https://docs.google.com/spreadsheets/', description: 'Google スプレッドシートを開く' },
  { cmd: 'spreadsheet', url: 'https://docs.google.com/spreadsheets/', description: 'Google スプレッドシートを開く' },
  { cmd: 'sheet', url: 'https://docs.google.com/spreadsheets/', description: 'Google スプレッドシートを開く' },
  { cmd: 'spreadsheets', url: 'https://docs.google.com/spreadsheets/', description: 'Google スプレッドシートを開く' },
  { cmd: 'class', url: 'https://classroom.google.com/', description: 'Google Classroomを開く' },
  { cmd: 'school', url: 'https://classroom.google.com/', description: 'Google Classroomを開く' },
  { cmd: 'classroom', url: 'https://classroom.google.com/', description: 'Google Classroomを開く' },
  { cmd: 'youtube', url: 'https://www.youtube.com/', description: 'YouTubeを開く' }
];

// Provide suggestions as the user types
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const query = text.toLowerCase().trim();
  
  // If the user typed something, filter the commands
  const matches = COMMANDS.filter(c => c.cmd.startsWith(query));
  
  const suggestions = matches.map(match => {
    return {
      content: match.cmd,
      description: `<match>/${match.cmd}</match> - <url>${match.description}</url>`
    };
  });
  
  suggest(suggestions);
});

// Execute the command when the user presses Enter
chrome.omnibox.onInputEntered.addListener((text) => {
  const query = text.toLowerCase().trim();
  
  // First, check if there is an exact match
  let matchedCmd = COMMANDS.find(c => c.cmd === query);
  
  // If no exact match, but there's a prefix match, use the first one
  if (!matchedCmd) {
    matchedCmd = COMMANDS.find(c => c.cmd.startsWith(query));
  }
  
  if (matchedCmd) {
    chrome.tabs.update({ url: matchedCmd.url });
  } else {
    // Fallback if no command matched: perhaps search Google or do nothing.
    chrome.tabs.update({ url: `https://www.google.com/search?q=${encodeURIComponent('/' + text)}` });
  }
});

// Set default suggestion text
chrome.omnibox.setDefaultSuggestion({
  description: 'コマンドを入力してください (例: docs, mail, youtube...)'
});

// ============================================================
//  ACCESS LOG TRACKING
// ============================================================
const SYNC_API_URL = 'https://homescreen-gules.vercel.app/api';
let accessLogBuffer = [];
let flushTimer = null;

// Extract domain from URL
function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Listen for page visits
chrome.history.onVisited.addListener((result) => {
  // Only track http/https URLs
  if (!result.url || (!result.url.startsWith('http://') && !result.url.startsWith('https://'))) {
    return;
  }

  accessLogBuffer.push({
    url: result.url,
    domain: extractDomain(result.url),
    title: result.title || null,
    visited_at: new Date().toISOString()
  });

  // Start or reset the flush timer (3 minutes)
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushAccessLogs, 180000);
});

// Flush buffered logs to the server
async function flushAccessLogs() {
  if (accessLogBuffer.length === 0) return;

  // Read token from localStorage via chrome.storage.local
  // Note: background.js (service worker) cannot access localStorage directly,
  // so we store a copy of the token in chrome.storage.local from script.js
  let token = null;
  try {
    const result = await chrome.storage.local.get('hs_sync_token');
    token = result.hs_sync_token || null;
  } catch (e) {
    console.error('Failed to read sync token from storage', e);
    return;
  }

  if (!token) {
    // Not logged in, clear buffer silently
    accessLogBuffer = [];
    return;
  }

  const logsToSend = [...accessLogBuffer];
  accessLogBuffer = [];

  try {
    const res = await fetch(`${SYNC_API_URL}/access-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ logs: logsToSend })
    });

    if (!res.ok) {
      const data = await res.json();
      console.error('Access log push failed:', data.error);
      // Put logs back in buffer for retry (up to 1000)
      accessLogBuffer = [...logsToSend, ...accessLogBuffer].slice(0, 1000);
    }
  } catch (err) {
    console.error('Access log push network error:', err);
    // Put logs back in buffer for retry
    accessLogBuffer = [...logsToSend, ...accessLogBuffer].slice(0, 1000);
  }
}

// Also flush when the service worker is about to be suspended
chrome.runtime.onSuspend && chrome.runtime.onSuspend.addListener(() => {
  flushAccessLogs();
});
