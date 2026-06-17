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

