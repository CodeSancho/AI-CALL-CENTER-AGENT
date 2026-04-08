const express = require('express');
const VoiceflowRoutes = require('./routes/Voiceflow');
const TestRoutes = require('./routes/testRoutes')

const app = express();

app.use(express.json());

// Register routes
app.use('/Voiceflow', VoiceflowRoutes);
app.use('testRoutes', TestRoutes)



module.exports = app;
