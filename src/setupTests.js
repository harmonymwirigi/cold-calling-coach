// src/setupTests.js
import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock Web Speech API
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: window.SpeechRecognition,
});

Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn(() => []),
    speaking: false,
  },
});

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }]
    })),
  },
});

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn(),
  createGain: jest.fn(),
  destination: {},
}));

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  config: {
    update: jest.fn(),
  },
  Polly: jest.fn(() => ({
    synthesizeSpeech: jest.fn(() => ({
      promise: () => Promise.resolve({
        AudioStream: new ArrayBuffer(8),
      }),
    })),
  })),
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                passed: true,
                feedback: "Good job!",
                scores: { criterion1: true, criterion2: true, criterion3: true, criterion4: false },
                overall_score: 3.0
              })
            }
          }]
        }))
      }
    }
  }));
});