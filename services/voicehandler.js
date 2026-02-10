// services/voiceHandler.js
/**
 * Voice Handler Service
 * Integrates Speech-to-Text (Deepgram), Text-to-Speech (ElevenLabs), and Voiceflow
 */

const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');

class voicehandler {
    constructor() {
        // API configurations
        this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
        this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        this.elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
        
        this.voiceflowApiKey = process.env.VOICEFLOW_API_KEY;
        this.voiceflowVersionId = process.env.VOICEFLOW_VERSION_ID;
        this.voiceflowBaseUrl = 'https://general-runtime.voiceflow.com';
        console.log("Deepgram key:", process.env.DEEPGRAM_API_KEY)
        console.log("ElevenLabs key:", process.env.ELEVENLABS_API_KEY);

    }

    /**
     * Convert audio to text using Deepgram
     * @param {Buffer} audioBuffer - Audio data in WAV/MP3/etc format
     * @returns {Promise<string>} - Transcribed text
     */
    async speechToText(audioBuffer) {
        try {
            console.log(' Converting speech to text...');
            
            const response = await axios.post(
                'https://api.deepgram.com/v1/listen',
                audioBuffer,
                {
                    headers: {
                        'Authorization': `Token ${this.deepgramApiKey}`,
                        'Content-Type': 'audio/wav'
                    },
                    params: {
                        model: 'nova-2',
                        language: 'en',
                        punctuate: true,
                        utterances: true,
                        smart_format: true
                    }
                }
            );

            const transcript = response.data.results.channels[0].alternatives[0].transcript;
            console.log(` Transcribed: "${transcript}"`);
            
            return transcript;

        } catch (error) {
            console.error(' Speech-to-Text error:', error.response?.data || error.message);
            throw new Error(`STT failed: ${error.message}`);
        }
    }

    /**
     * Convert text to speech using ElevenLabs
     * @param {string} text - Text to convert to speech
     * @returns {Promise<Buffer>} - Audio data
     */
    async textToSpeech(text) {
        try {
            console.log(` Converting text to speech: "${text}"`);
            
            const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
                {
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    }
                },
                {
                    headers: {
                        'xi-api-key': this.elevenLabsApiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg'
                    },
                    responseType: 'arraybuffer'
                }
            );

            console.log(' Audio generated successfully');
            return Buffer.from(response.data);

        } catch (error) {
            console.error(' Text-to-Speech error:', error.response?.data || error.message);
            throw new Error(`TTS failed: ${error.message}`);
        }
    }

    /**
     * Get AI response from Voiceflow
     * @param {string} sessionId - Session identifier
     * @param {string} userMessage - User's message
     * @returns {Promise<string>} - AI's response text
     */
    async getAIResponse(sessionId, userMessage) {
        try {
            console.log(` Getting AI response for: "${userMessage}"`);
            
            const response = await axios.post(
                `${this.voiceflowBaseUrl}/state/user/${sessionId}/interact`,
                {
                    action: {
                        type: 'text',
                        payload: userMessage
                    }
                },
                {
                    headers: {
                        'Authorization': this.voiceflowApiKey,
                        'Content-Type': 'application/json',
                        'versionID': this.voiceflowVersionId
                    }
                }
            );

            // Extract text responses
            const textResponses = response.data
                .filter(item => item.type === 'text')
                .map(item => item.payload.message);

            const fullResponse = textResponses.join(' ');
            console.log(`AI Response: "${fullResponse}"`);

            return fullResponse;

        } catch (error) {
            console.error(' Voiceflow error:', error.response?.data || error.message);
            throw new Error(`Voiceflow failed: ${error.message}`);
        }
    }

    /**
     * Launch a new Voiceflow session and get greeting
     * @param {string} sessionId - Session identifier
     * @returns {Promise<string>} - Greeting message
     */
    async launchSession(sessionId) {
        try {
            console.log(`🚀 Launching Voiceflow session: ${sessionId}`);
            
            const response = await axios.post(
                `${this.voiceflowBaseUrl}/state/user/${sessionId}/interact`,
                {
                    action: { type: 'launch' }
                },
                {
                    headers: {
                        'Authorization': this.voiceflowApiKey,
                        'Content-Type': 'application/json',
                        'versionID': this.voiceflowVersionId
                    }
                }
            );

            const greeting = response.data
                .filter(item => item.type === 'text')
                .map(item => item.payload.message)
                .join(' ');

            console.log(` Greeting: "${greeting}"`);
            return greeting;

        } catch (error) {
            console.error(' Session launch error:', error.response?.data || error.message);
            throw new Error(`Session launch failed: ${error.message}`);
        }
    }

    /**
     * Complete voice interaction pipeline:
     * Audio → Text → AI → Text → Audio
     * @param {Buffer} audioBuffer - Input audio
     * @param {string} sessionId - Session ID
     * @returns {Promise<{transcript: string, aiResponse: string, audioResponse: Buffer}>}
     */
    async processVoiceInput(audioBuffer, sessionId) {
        try {
            // Step 1: Convert speech to text
            const transcript = await this.speechToText(audioBuffer);

            if (!transcript || transcript.trim().length === 0) {
                throw new Error('No speech detected in audio');
            }

            // Step 2: Get AI response
            const aiResponse = await this.getAIResponse(sessionId, transcript);

            // Step 3: Convert AI response to speech
            const audioResponse = await this.textToSpeech(aiResponse);

            return {
                transcript,
                aiResponse,
                audioResponse
            };

        } catch (error) {
            console.error(' Voice processing error:', error.message);
            throw error;
        }
    }
}

module.exports = voicehandler;