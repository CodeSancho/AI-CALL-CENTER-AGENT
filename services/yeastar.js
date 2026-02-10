// services/yeastarService.js
/**
 * Yeastar PBX Integration Service
 * Handles call control, webhooks, and audio streaming
 */

const axios = require('axios');
const https = require('https');
const { Yeastar } = require('../config');

class yeastar {
    constructor() {
        this.apiUrl = process.env.YEASTAR_API_URL;
        this.username = process.env.YEASTAR_USERNAME;
        this.password = process.env.YEASTAR_PASSWORD;
        this.token = null;
        this.tokenExpiry = null;

        // Disable SSL verification for self-signed certificates
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
    }

    /**
     * Login to Yeastar PBX and get access token
     */
    async login() {
        try {
            console.log(' Logging into Yeastar PBX...');
            
            const response = await axios.post(
                `${this.apiUrl}/login`,
                {
                    username: this.username,
                    password: this.password
                },
                {
                    httpsAgent: this.httpsAgent,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            this.token = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            console.log('✓ Logged into Yeastar PBX');
            return this.token;

        } catch (error) {
            console.error(' Yeastar login failed:', error.response?.data || error.message);
            throw new Error(`Yeastar login failed: ${error.message}`);
        }
    }

    /**
     * Ensure we have a valid token
     */
    async ensureAuthenticated() {
        if (!this.token || Date.now() >= this.tokenExpiry) {
            await this.login();
        }
    }

    /**
     * Answer an incoming call
     * @param {string} callId - Call identifier from Yeastar
     */
    async answerCall(callId) {
        try {
            await this.ensureAuthenticated();
            
            console.log(` Answering call: ${callId}`);
            
            const response = await axios.post(
                `${this.apiUrl}/call/accept`,
                {
                    callid: callId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log('✓ Call answered');
            return response.data;

        } catch (error) {
            console.error(' Answer call failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Play audio file to caller
     * @param {string} callId - Call identifier
     * @param {string} audioFile - Path to audio file on PBX
     */
    async playAudio(callId, audioFile) {
        try {
            await this.ensureAuthenticated();
            
            console.log(`🔊 Playing audio on call ${callId}: ${audioFile}`);
            
            const response = await axios.post(
                `${this.apiUrl}/call/playprompt`,
                {
                    callid: callId,
                    prompt: audioFile
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log('Audio playing');
            return response.data;

        } catch (error) {
            console.error(' Play audio failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Hangup a call
     * @param {string} callId - Call identifier
     */
    async hangupCall(callId) {
        try {
            await this.ensureAuthenticated();
            
            console.log(` Hanging up call: ${callId}`);
            
            const response = await axios.post(
                `${this.apiUrl}/call/hangup`,
                {
                    callid: callId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log('✓ Call hung up');
            return response.data;

        } catch (error) {
            console.error(' Hangup failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make an outbound call
     * @param {string} from - Extension to call from
     * @param {string} to - Number to call
     */
    async makeCall(from, to) {
        try {
            await this.ensureAuthenticated();
            
            console.log(` Making call from ${from} to ${to}`);
            
            const response = await axios.post(
                `${this.apiUrl}/call/dial`,
                {
                    caller: from,
                    callee: to
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log('✓ Call initiated');
            return response.data;

        } catch (error) {
            console.error(' Make call failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get call information
     * @param {string} callId - Call identifier
     */
    async getCallInfo(callId) {
        try {
            await this.ensureAuthenticated();
            
            const response = await axios.get(
                `${this.apiUrl}/call/query`,
                {
                    params: { callid: callId },
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            return response.data;

        } catch (error) {
            console.error(' Get call info failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload audio file to Yeastar PBX
     * @param {Buffer} audioBuffer - Audio data
     * @param {string} filename - Filename to save as
     */
    async uploadAudioFile(audioBuffer, filename) {
        try {
            await this.ensureAuthenticated();
            
            console.log(`Uploading audio file: ${filename}`);
            
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', audioBuffer, {
                filename: filename,
                contentType: 'audio/mpeg'
            });

            const response = await axios.post(
                `${this.apiUrl}/prompt/upload`,
                form,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        ...form.getHeaders()
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log('✓ Audio file uploaded');
            return response.data;

        } catch (error) {
            console.error('❌ Upload failed:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = yeastar;