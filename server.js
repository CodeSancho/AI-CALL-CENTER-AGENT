// server.js
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(` AI Agent Server running on port ${PORT}`);
    console.log(` API endpoint: http://localhost:${PORT}/Voiceflow`);
    console.log('\ Voiceflow API Key loaded:', !!process.env.VOICEFLOW_API_KEY);
    console.log(' Voiceflow Project ID:', process.env.VOICEFLOW_PROJECT_ID);
    console.log(' Voiceflow Version ID:', process.env.VOICEFLOW_VERSION_ID);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n Server shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n Server shutting down...');
    process.exit(0);
});
