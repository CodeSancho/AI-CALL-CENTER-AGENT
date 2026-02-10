// routes/VoiceflowWithVoice.js

const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const voicehandler = require('../services/voicehandler');  
const yeastar = require('../services/yeastar');

const voicehandlerInstance = new voicehandler();  
const yeastarInstance = new yeastar();            

// Store active sessions
const activeSessions = new Map();

/**
 * Health Check
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        services: {
            voiceflow: !!process.env.VOICEFLOW_API_KEY,
            deepgram: !!process.env.DEEPGRAM_API_KEY,
            elevenlabs: !!process.env.ELEVENLABS_API_KEY,
            yeastar: !!process.env.YEASTAR_API_URL
        },
        activeSessions: activeSessions.size,
        timestamp: new Date().toISOString()
    });
});

/**
 * START SESSION (Text-based)
 * POST /Voiceflow/session/start
 */
router.post('/session/start', async (req, res) => {
    try {
        const { userId, phoneNumber } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId is required' 
            });
        }

        const sessionId = `session_${userId}_${Date.now()}`;
        
        console.log(` Starting session: ${sessionId}`);

        // Launch Voiceflow session
        const greeting = await voicehandlerInstance.launchSession(sessionId);

        // Store session
        activeSessions.set(sessionId, {
            userId,
            phoneNumber,
            type: 'text',
            startTime: new Date(),
            messageCount: 0
        });

        res.json({
            success: true,
            sessionId,
            greeting,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(' Error starting session:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * SEND TEXT MESSAGE
 * POST /Voiceflow/message
 */
router.post('/message', async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!sessionId || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'sessionId and message are required' 
            });
        }

        console.log(` Message from ${sessionId}: "${message}"`);

        // Get AI response
        const aiResponse = await voicehandlerInstance.getAIResponse(sessionId, message);

        // Update session
        const session = activeSessions.get(sessionId);
        if (session) {
            session.messageCount++;
            session.lastMessage = new Date();
        }

        res.json({
            success: true,
            sessionId,
            response: aiResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(' Error processing message:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PROCESS VOICE INPUT (with audio file upload)
 * POST /Voiceflow/voice/input
 * Form-data: audio file + sessionId
 */
router.post('/voice/input', upload.single('audio'), async (req, res) => {
    try {
        const { sessionId } = req.body;
        const audioBuffer = req.file?.buffer;

        if (!sessionId || !audioBuffer) {
            return res.status(400).json({ 
                success: false, 
                error: 'sessionId and audio file are required' 
            });
        }

        console.log(` Processing voice input for ${sessionId}`);

        // Process voice: Audio → Text → AI → Text → Audio
        const result = await voicehandlerInstance.processVoiceInput(audioBuffer, sessionId);

        // Update session
        const session = activeSessions.get(sessionId);
        if (session) {
            session.messageCount++;
            session.lastMessage = new Date();
        }

        res.json({
            success: true,
            sessionId,
            transcript: result.transcript,
            response: result.aiResponse,
            audioResponse: result.audioResponse.toString('base64'), // Send as base64
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(' Error processing voice:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * INCOMING CALL from Yeastar PBX (Webhook)
 * POST /Voiceflow/call/incoming
 */
router.post('/call/incoming', async (req, res) => {
    try {
        const { callid, from, to } = req.body;

        if (!callid) {
            return res.status(400).json({ 
                success: false, 
                error: 'callid is required' 
            });
        }

        console.log(` Incoming call from ${from} to ${to} (Call ID: ${callid})`);

        // Create session for this call
        const sessionId = `call_${callid}_${Date.now()}`;

        // Launch Voiceflow and get greeting
        const greeting = await voicehandlerInstance.launchSession(sessionId);

        // Convert greeting to speech
        const greetingAudio = await voicehandlerInstance.textToSpeech(greeting);

        // Upload audio to Yeastar
        const filename = `greeting_${sessionId}.mp3`;
        await yeastarInstance.uploadAudioFile(greetingAudio, filename);

        // Answer the call
        await yeastarInstance.answerCall(callid);

        // Play greeting
        await yeastarInstance.playAudio(callid, filename);

        // Store call session
        activeSessions.set(sessionId, {
            callId: callid,
            from,
            to,
            type: 'voice',
            startTime: new Date(),
            messageCount: 0
        });

        console.log(` Call answered and greeting played`);

        res.json({
            success: true,
            sessionId,
            callId: callid,
            greeting,
            action: 'answered_and_greeted'
        });

    } catch (error) {
        console.error(' Error handling incoming call:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            action: 'failed'
        });
    }
});

/**
 * PROCESS SPEECH from Call (Webhook from Yeastar after recording)
 * POST /Voiceflow/call/speech
 */
router.post('/call/speech', upload.single('audio'), async (req, res) => {
    try {
        const { sessionId, callid } = req.body;
        const audioBuffer = req.file?.buffer;

        if (!sessionId || !audioBuffer) {
            return res.status(400).json({ 
                success: false, 
                error: 'sessionId and audio are required' 
            });
        }

        console.log(` Processing speech for call ${callid}`);

        // Process voice: Audio → Text → AI → Text → Audio
        const result = await voicehandlerInstance.processVoiceInput(audioBuffer, sessionId);

        // Upload AI response audio to Yeastar
        const filename = `response_${sessionId}_${Date.now()}.mp3`;
        await yeastarInstance.uploadAudioFile(result.audioResponse, filename);

        // Play response to caller
        await yeastarInstance.playAudio(callid, filename);

        // Update session
        const session = activeSessions.get(sessionId);
        if (session) {
            session.messageCount++;
            session.lastMessage = new Date();
        }

        console.log(` Response played: "${result.aiResponse}"`);

        res.json({
            success: true,
            sessionId,
            transcript: result.transcript,
            response: result.aiResponse,
            action: 'response_played'
        });

    } catch (error) {
        console.error(' Error processing speech:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * HANGUP CALL
 * POST /Voiceflow/call/hangup
 */
router.post('/call/hangup', async (req, res) => {
    try {
        const { callid, sessionId } = req.body;

        if (callid) {
            await yeastarInstance.hangupCall(callid);
        }

        if (sessionId) {
            const session = activeSessions.get(sessionId);
            if (session) {
                const duration = new Date() - session.startTime;
                console.log(` Call ended: ${sessionId}`);
                console.log(` Duration: ${Math.round(duration / 1000)}s`);
                console.log(` Messages: ${session.messageCount}`);
                
                activeSessions.delete(sessionId);
            }
        }

        res.json({
            success: true,
            message: 'Call ended'
        });

    } catch (error) {
        console.error(' Error hanging up:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * MAKE OUTBOUND CALL
 * POST /Voiceflow/call/outbound
 */
router.post('/call/outbound', async (req, res) => {
    try {
        const { from, to, userId } = req.body;

        if (!from || !to) {
            return res.status(400).json({ 
                success: false, 
                error: 'from and to are required' 
            });
        }

        console.log(` Making outbound call from ${from} to ${to}`);

        // Make the call
        const callData = await yeastarInstance.makeCall(from, to);
        const callId = callData.callid;

        // Create session
        const sessionId = `outbound_${callId}_${Date.now()}`;

        // Store session
        activeSessions.set(sessionId, {
            callId,
            from,
            to,
            userId,
            type: 'outbound',
            startTime: new Date(),
            messageCount: 0
        });

        res.json({
            success: true,
            sessionId,
            callId,
            message: 'Outbound call initiated'
        });

    } catch (error) {
        console.error(' Error making outbound call:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET ACTIVE SESSIONS
 * GET /Voiceflow/sessions
 */
router.get('/sessions', (req, res) => {
    const sessions = Array.from(activeSessions.entries()).map(([id, data]) => ({
        sessionId: id,
        ...data,
        duration: new Date() - data.startTime
    }));

    res.json({
        success: true,
        count: sessions.length,
        sessions
    });
});

/**
 * END SESSION
 * POST /Voiceflow/session/end
 */
router.post('/session/end', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ 
                success: false, 
                error: 'sessionId is required' 
            });
        }

        const session = activeSessions.get(sessionId);
        
        if (session) {
            // If it's a voice call, hang up
            if (session.callId) {
                await yeastarInstance.hangupCall(session.callId);
            }

            const duration = new Date() - session.startTime;
            console.log(` Session ended: ${sessionId}`);
            console.log(` Duration: ${Math.round(duration / 1000)}s`);
            console.log(` Messages: ${session.messageCount}`);
            
            activeSessions.delete(sessionId);
        }

        res.json({
            success: true,
            message: 'Session ended successfully'
        });

    } catch (error) {
        console.error(' Error ending session:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;