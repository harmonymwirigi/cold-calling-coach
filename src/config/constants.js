// src/config/constants.js
export const ROLEPLAY_TYPES = {
    OPENER_PRACTICE: 'opener_practice',
    PITCH_PRACTICE: 'pitch_practice', 
    WARMUP_CHALLENGE: 'warmup_challenge',
    FULL_SIMULATION: 'full_simulation',
    POWER_HOUR: 'power_hour'
  };
  
  export const MODES = {
    PRACTICE: 'practice',
    MARATHON: 'marathon',
    LEGEND: 'legend'
  };
  
  export const ACCESS_LEVELS = {
    TRIAL: 'TRIAL',
    UNLIMITED: 'UNLIMITED',
    LIMITED: 'LIMITED'
  };
  
  export const CALL_STATES = {
    IDLE: 'idle',
    DIALING: 'dialing',
    CONNECTED: 'connected',
    ENDED: 'ended'
  };
  
  export const EVALUATION_STAGES = {
    GREETING: 'greeting',
    EARLY_OBJECTION: 'early_objection', 
    MINI_PITCH: 'mini_pitch',
    POST_PITCH: 'post_pitch',
    QUALIFICATION: 'qualification',
    MEETING_ASK: 'meeting_ask',
    HANG_UP: 'hang_up'
  };
  
  // Roleplay configuration based on instructions
  export const ROLEPLAY_CONFIG = {
    [ROLEPLAY_TYPES.OPENER_PRACTICE]: {
      title: "Opener + Early Objections",
      description: "Master your opening and handle immediate pushback",
      stages: [EVALUATION_STAGES.GREETING, EVALUATION_STAGES.EARLY_OBJECTION, EVALUATION_STAGES.MINI_PITCH],
      unlockRequirement: null,
      modes: [MODES.PRACTICE, MODES.MARATHON, MODES.LEGEND]
    },
    [ROLEPLAY_TYPES.PITCH_PRACTICE]: {
      title: "Pitch + Objections + Close",
      description: "Deliver compelling pitches and close for meetings", 
      stages: [EVALUATION_STAGES.MINI_PITCH, EVALUATION_STAGES.POST_PITCH, EVALUATION_STAGES.QUALIFICATION, EVALUATION_STAGES.MEETING_ASK],
      unlockRequirement: 'opener_practice_marathon_pass',
      modes: [MODES.PRACTICE, MODES.MARATHON, MODES.LEGEND]
    },
    [ROLEPLAY_TYPES.WARMUP_CHALLENGE]: {
      title: "Warm-up Challenge",
      description: "25 rapid-fire questions to test your skills",
      stages: ['quickfire'],
      unlockRequirement: 'pitch_practice_marathon_pass',
      modes: [MODES.PRACTICE]
    },
    [ROLEPLAY_TYPES.FULL_SIMULATION]: {
      title: "Full Cold Call Simulation",
      description: "Complete call from start to finish",
      stages: [EVALUATION_STAGES.GREETING, EVALUATION_STAGES.EARLY_OBJECTION, EVALUATION_STAGES.MINI_PITCH, EVALUATION_STAGES.POST_PITCH, EVALUATION_STAGES.QUALIFICATION, EVALUATION_STAGES.MEETING_ASK],
      unlockRequirement: 'warmup_challenge_pass',
      modes: [MODES.PRACTICE]
    },
    [ROLEPLAY_TYPES.POWER_HOUR]: {
      title: "Power Hour Challenge",
      description: "20 consecutive calls - ultimate test",
      stages: ['power_hour'],
      unlockRequirement: 'full_simulation_pass',
      modes: [MODES.PRACTICE]
    }
  };
  
  // Voice service configuration
  export const VOICE_CONFIG = {
    POLLY: {
      voices: {
        JOANNA: 'Joanna',
        KENDRA: 'Kendra',
        KIMBERLY: 'Kimberly'
      },
      defaultVoice: 'Joanna',
      defaultRate: 0.9,
      defaultPitch: 1.0
    },
    SPEECH_RECOGNITION: {
      lang: 'en-US',
      continuous: false,
      interimResults: false,
      maxAlternatives: 1
    },
    SILENCE_TIMEOUTS: {
      WARNING: 10000, // 10 seconds
      HANGUP: 15000   // 15 seconds
    }
  };
  
  // Error messages
  export const ERROR_MESSAGES = {
    VOICE_NOT_SUPPORTED: 'Voice features are not supported in this browser. Please use Chrome, Firefox, or Safari.',
    MICROPHONE_DENIED: 'Microphone access is required for voice training. Please allow microphone access and try again.',
    NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    ROLEPLAY_LOCKED: 'This roleplay is locked. Complete the previous modules to unlock it.',
    API_ERROR: 'Service temporarily unavailable. Please try again in a few moments.'
  };
  