// src/hooks/useVoice.js
import { useState, useRef, useCallback } from 'react';
import { voiceService } from '../services/polly';

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = useCallback((onResult, onError) => {
    if (!('webkitSpeechRecognition' in window)) {
      onError('Speech recognition not supported');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      onResult(transcript, confidence);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      onError(event.error);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const speak = useCallback(async (text, voiceId = 'Joanna') => {
    try {
      setIsSpeaking(true);
      const result = await voiceService.textToSpeech(text, voiceId);
      
      if (result.success) {
        await voiceService.playAudio(result.audioUrl);
      }
    } catch (error) {
      logger.error('Speech error:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak
  };
};

// API Route for Resend (create as /api/send-email.js in your backend)
/*
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  try {
    await resend.emails.send({
      from: 'Cold Calling Coach <noreply@yourdomain.com>',
      to: email,
      subject: 'Your verification code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to AI Cold Calling Coach!</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #2563eb; padding: 20px; background: #eff6ff; border-radius: 8px; text-align: center; margin: 20px 0;">
            ${code}
          </div>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
*/