// Thread Crawler Server
// Minimal server for Reddit Devvit webview communication

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', game: 'Thread Crawler' });
});

app.listen(PORT, () => {
  console.log(`Thread Crawler server running on port ${PORT}`);
});

module.exports = app;
