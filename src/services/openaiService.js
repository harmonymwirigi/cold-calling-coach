// src/services/openaiService.js - ENHANCED VERSION WITH PROPER ROLEPLAY LOGIC
import OpenAI from 'openai';
import logger from '../utils/logger';

// Roleplay stage definitions
const ROLEPLAY_STAGES = {
  GREETING: 'greeting',
  OPENER: 'opener',
  EARLY_OBJECTION: 'early_objection',
  MINI_PITCH: 'mini_pitch',
  POST_PITCH: 'post_pitch',
  QUALIFICATION: 'qualification',
  MEETING_ASK: 'meeting_ask',
  WRAP_UP: 'wrap_up',
  HANG_UP: 'hang_up'
};

// Objection libraries from roleplay instructions
const EARLY_OBJECTIONS = [
  "What's this about?",
  "I'm not interested",
  "We don't take cold calls",
  "Now is not a good time",
  "I have a meeting",
  "Can you call me later?",
  "I'm about to go into a meeting",
  "Send me an email",
  "Can you send me the information?",
  "Can you message me on WhatsApp?",
  "Who gave you this number?",
  "This is my personal number",
  "Where did you get my number?",
  "What are you trying to sell me?",
  "Is this a sales call?",
  "Is this a cold call?",
  "Are you trying to sell me something?",
  "We are ok for the moment",
  "We are all good / all set",
  "We're not looking for anything right now",
  "We are not changing anything",
  "How long is this going to take?",
  "Is this going to take long?",
  "What company are you calling from?",
  "Who are you again?",
  "Where are you calling from?",
  "I never heard of you",
  "Not interested right now",
  "Just send me the details"
];

const POST_PITCH_OBJECTIONS = [
  "It's too expensive for us.",
  "We have no budget for this right now.",
  "Your competitor is cheaper.",
  "Can you give us a discount?",
  "This isn't a good time.",
  "We've already set this year's budget.",
  "Call me back next quarter.",
  "We're busy with other projects right now.",
  "We already use [competitor] and we're happy.",
  "We built something similar ourselves.",
  "How exactly are you better than [competitor]?",
  "Switching providers seems like a lot of work.",
  "I've never heard of your company.",
  "Who else like us have you worked with?",
  "Can you send customer testimonials?",
  "How do I know this will really work?",
  "I'm not the decision-maker.",
  "I need approval from my team first.",
  "Can you send details so I can forward them?",
  "We'll need buy-in from other departments.",
  "How long does this take to implement?",
  "We don't have time to learn a new system.",
  "I'm concerned this won't integrate with our existing tools.",
  "What happens if this doesn't work as promised?"
];

const IMPATIENCE_PHRASES = [
  "Hello? Are you still with me?",
  "Can you hear me?",
  "Just checking you're there…",
  "Still on the line?",
  "I don't have much time for this.",
  "Sounds like you are gone.",
  "Are you an idiot.",
  "What is going on.",
  "Are you okay to continue?",
  "I am afraid I have to go."
];

// Detailed rubrics from roleplay instructions
const RUBRICS = {
  OPENER: {
    name: 'Opener',
    passThreshold: 3,
    maxScore: 4,
    criteria: [
      {
        id: 'clear_opener',
        description: 'Clear cold call opener (pattern interrupt, permission-based, or value-first)',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return lowerText.includes('calling') || lowerText.includes('reach out') || 
                 lowerText.includes('connect') || lowerText.includes('minute') ||
                 lowerText.includes('quick') || lowerText.includes('moment');
        }
      },
      {
        id: 'casual_tone',
        description: 'Casual, confident tone (uses contractions and short phrases)',
        check: (text) => {
          const hasContractions = /\b(i'm|you're|it's|that's|we're|i've|haven't|don't|won't|can't|wouldn't)\b/i.test(text);
          const wordCount = text.split(/\s+/).length;
          return hasContractions || wordCount < 30;
        }
      },
      {
        id: 'empathy',
        description: 'Demonstrates empathy: Acknowledges the interruption, unfamiliarity, or randomness',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return lowerText.includes('out of the blue') || lowerText.includes('don\'t know me') ||
                 lowerText.includes('cold call') || lowerText.includes('caught you') ||
                 lowerText.includes('interrupting') || lowerText.includes('unexpected') ||
                 lowerText.includes('random') || lowerText.includes('surprise');
        }
      },
      {
        id: 'soft_question',
        description: 'Ends with a soft question',
        check: (text) => {
          const trimmed = text.trim();
          return trimmed.endsWith('?') && (
            trimmed.toLowerCase().includes('can i') || trimmed.toLowerCase().includes('could i') ||
            trimmed.toLowerCase().includes('would you') || trimmed.toLowerCase().includes('is it okay') ||
            trimmed.toLowerCase().includes('mind if') || trimmed.toLowerCase().includes('fair enough')
          );
        }
      }
    ]
  },
  OBJECTION_HANDLING: {
    name: 'Objection Handling',
    passThreshold: 3,
    maxScore: 4,
    criteria: [
      {
        id: 'calm_acknowledgment',
        description: 'Acknowledges calmly (e.g., "Fair enough" / "Totally get that")',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return lowerText.includes('fair') || lowerText.includes('understand') ||
                 lowerText.includes('get that') || lowerText.includes('appreciate') ||
                 lowerText.includes('makes sense') || lowerText.includes('hear you');
        }
      },
      {
        id: 'no_argue',
        description: 'Doesn\'t argue or pitch immediately',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return !lowerText.includes('but you') && !lowerText.includes('actually') &&
                 !lowerText.includes('wrong') && text.length < 150;
        }
      },
      {
        id: 'reframe',
        description: 'Reframes or buys time in 1 sentence',
        check: (text) => {
          const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
          return sentences.length <= 2;
        }
      },
      {
        id: 'forward_question',
        description: 'Ends with a forward-moving question',
        check: (text) => {
          return text.trim().endsWith('?');
        }
      }
    ]
  },
  MINI_PITCH: {
    name: 'Mini Pitch + Soft Discovery',
    passThreshold: 3,
    maxScore: 4,
    criteria: [
      {
        id: 'short',
        description: 'Short (1-2 sentences)',
        check: (text) => {
          const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
          return sentences.length <= 3;
        }
      },
      {
        id: 'outcome_focused',
        description: 'Focuses on problem solved or outcome delivered',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return lowerText.includes('help') || lowerText.includes('solve') ||
                 lowerText.includes('improve') || lowerText.includes('increase') ||
                 lowerText.includes('reduce') || lowerText.includes('save');
        }
      },
      {
        id: 'simple_english',
        description: 'Simple English (no jargon or buzzwords)',
        check: (text) => {
          const jargon = /\b(synergy|leverage|paradigm|optimize|streamline|scalable|robust|innovative|cutting-edge|disruptive)\b/i;
          return !jargon.test(text);
        }
      },
      {
        id: 'natural',
        description: 'Sounds natural (not robotic or memorized)',
        check: (text) => {
          const wordCount = text.split(/\s+/).length;
          return wordCount < 50 && /\b(i|we|you|your)\b/i.test(text);
        }
      }
    ]
  },
  UNCOVERING_PAIN: {
    name: 'Uncovering Pain',
    passThreshold: 2,
    maxScore: 3,
    criteria: [
      {
        id: 'tied_question',
        description: 'Asks a short question tied to the pitch',
        check: (text) => {
          return text.includes('?') && text.split(/\s+/).length < 20;
        }
      },
      {
        id: 'open_curious',
        description: 'Question is open/curious',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return lowerText.includes('how') || lowerText.includes('what') ||
                 lowerText.includes('tell me') || lowerText.includes('curious');
        }
      },
      {
        id: 'soft_tone',
        description: 'Tone is soft and non-pushy',
        check: (text) => {
          const lowerText = text.toLowerCase();
          return !lowerText.includes('must') && !lowerText.includes('need to') &&
                 !lowerText.includes('have to') && !lowerText.includes('should');
        }
      }
    ]
  }
};

export class OpenAIService {
  constructor() {
    this.conversationHistory = [];
    this.currentStage = ROLEPLAY_STAGES.GREETING;
    this.usedObjections = new Set();
    this.sessionData = {};
    this.isInitialized = false;
    this.silenceStartTime = null;
    this.lastUserInput = null;
  }

  async initialize() {
    try {
      if (this.isInitialized) return true;

      logger.log('🤖 Initializing OpenAI service...');

      if (!process.env.REACT_APP_OPENAI_API_KEY) {
        throw new Error('OpenAI API key not found');
      }

      this.client = new OpenAI({
        apiKey: process.env.REACT_APP_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      this.isInitialized = true;
      logger.log('✅ OpenAI service initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ OpenAI service initialization failed:', error);
      throw error;
    }
  }

  // Main method to get AI prospect response following roleplay flow
  async getProspectResponse(userInput, context, stage = null) {
    try {
      // Use provided stage or current stage
      const currentStage = stage || this.currentStage;
      logger.log('🤖 AI Processing:', { userInput, stage: currentStage, context: context.roleplayType });
      
      // Handle silence detection
      if (!userInput && this.silenceStartTime) {
        const silenceDuration = Date.now() - this.silenceStartTime;
        if (silenceDuration >= 10000 && silenceDuration < 15000) {
          return {
            success: true,
            response: this.getImpatiencePhrase(),
            stage: currentStage,
            nextStage: currentStage,
            shouldHangUp: false
          };
        } else if (silenceDuration >= 15000) {
          return {
            success: true,
            response: "I am afraid I have to go.",
            stage: currentStage,
            nextStage: ROLEPLAY_STAGES.HANG_UP,
            shouldHangUp: true
          };
        }
      }

      // Reset silence timer on user input
      if (userInput) {
        this.silenceStartTime = null;
        this.lastUserInput = userInput;
      }

      // Route to appropriate handler based on stage
      let result;
      switch (currentStage) {
        case ROLEPLAY_STAGES.GREETING:
          result = await this.handleGreetingStage();
          break;
        case ROLEPLAY_STAGES.OPENER:
          result = await this.handleOpenerStage(userInput, context);
          break;
        case ROLEPLAY_STAGES.EARLY_OBJECTION:
          result = await this.handleObjectionStage(userInput, context);
          break;
        case ROLEPLAY_STAGES.MINI_PITCH:
          result = await this.handleMiniPitchStage(userInput, context);
          break;
        case ROLEPLAY_STAGES.POST_PITCH:
          result = await this.handlePostPitchStage(userInput, context);
          break;
        case ROLEPLAY_STAGES.QUALIFICATION:
          result = await this.handleQualificationStage(userInput, context);
          break;
        case ROLEPLAY_STAGES.MEETING_ASK:
          result = await this.handleMeetingAskStage(userInput, context);
          break;
        default:
          result = await this.handleDefaultStage(userInput, context);
      }

      // Update conversation history
      if (userInput) {
        this.conversationHistory.push(
          { role: 'user', content: userInput },
          { role: 'assistant', content: result.response }
        );
      }

      // Update current stage
      if (result.nextStage) {
        this.currentStage = result.nextStage;
      }

      return result;

    } catch (error) {
      logger.error('❌ OpenAI API error:', error);
      return {
        success: false,
        error: error.message,
        response: this.getFallbackResponse(this.currentStage),
        evaluation: { passed: false, feedback: 'Technical error occurred' }
      };
    }
  }

  // Handle greeting stage (initial "Hello")
  async handleGreetingStage() {
    logger.log('🎯 Handling greeting stage');
    this.currentStage = ROLEPLAY_STAGES.OPENER;
    return {
      success: true,
      response: "Hello?",
      stage: ROLEPLAY_STAGES.GREETING,
      nextStage: ROLEPLAY_STAGES.OPENER,
      shouldHangUp: false
    };
  }

  // Handle opener stage with evaluation
  async handleOpenerStage(userInput, context) {
    logger.log('🎯 Handling opener stage');
    
    if (!userInput) {
      return {
        success: true,
        response: "Hello? Anyone there?",
        stage: ROLEPLAY_STAGES.OPENER,
        nextStage: ROLEPLAY_STAGES.OPENER,
        shouldHangUp: false
      };
    }

    // Evaluate opener
    const evaluation = this.evaluateWithRubric(userInput, RUBRICS.OPENER);
    logger.log('📊 Opener evaluation:', evaluation);

    if (!evaluation.passed) {
      // Failed opener - hang up
      return {
        success: true,
        response: "Sorry, I don't have time for this. *click*",
        evaluation,
        stage: ROLEPLAY_STAGES.OPENER,
        nextStage: ROLEPLAY_STAGES.HANG_UP,
        shouldHangUp: true
      };
    }

    // Passed opener - check for random hang-up (20-30% chance)
    if (context.mode === 'practice' && Math.random() < 0.25) {
      logger.log('🎲 Random hang-up triggered');
      return {
        success: true,
        response: "Sorry, got to run. *click*",
        evaluation,
        stage: ROLEPLAY_STAGES.OPENER,
        nextStage: ROLEPLAY_STAGES.HANG_UP,
        shouldHangUp: true
      };
    }

    // Move to objection stage
    const objection = this.getRandomObjection('early');
    return {
      success: true,
      response: objection,
      evaluation,
      stage: ROLEPLAY_STAGES.OPENER,
      nextStage: ROLEPLAY_STAGES.EARLY_OBJECTION,
      shouldHangUp: false
    };
  }

  // Handle objection stage
  async handleObjectionStage(userInput, context) {
    logger.log('🎯 Handling objection stage');
    
    if (!userInput) {
      return {
        success: true,
        response: "Well? I asked you a question.",
        stage: ROLEPLAY_STAGES.EARLY_OBJECTION,
        nextStage: ROLEPLAY_STAGES.EARLY_OBJECTION,
        shouldHangUp: false
      };
    }

    // Evaluate objection handling
    const evaluation = this.evaluateWithRubric(userInput, RUBRICS.OBJECTION_HANDLING);
    logger.log('📊 Objection handling evaluation:', evaluation);

    if (!evaluation.passed) {
      // Failed objection handling
      return {
        success: true,
        response: "Look, I really don't have time for this. Goodbye. *click*",
        evaluation,
        stage: ROLEPLAY_STAGES.EARLY_OBJECTION,
        nextStage: ROLEPLAY_STAGES.HANG_UP,
        shouldHangUp: true
      };
    }

    // Passed - move to mini pitch stage
    const prompts = [
      "Alright, I'm listening. What is it?",
      "You've got 30 seconds.",
      "Okay, tell me more.",
      "Go ahead, what's this about?",
      "I'm listening."
    ];
    
    return {
      success: true,
      response: prompts[Math.floor(Math.random() * prompts.length)],
      evaluation,
      stage: ROLEPLAY_STAGES.EARLY_OBJECTION,
      nextStage: ROLEPLAY_STAGES.MINI_PITCH,
      shouldHangUp: false
    };
  }

  // Handle mini pitch stage
  async handleMiniPitchStage(userInput, context) {
    logger.log('🎯 Handling mini pitch stage');
    
    if (!userInput) {
      return {
        success: true,
        response: "Are you still there? What were you going to tell me?",
        stage: ROLEPLAY_STAGES.MINI_PITCH,
        nextStage: ROLEPLAY_STAGES.MINI_PITCH,
        shouldHangUp: false
      };
    }

    // Evaluate mini pitch
    const pitchEval = this.evaluateWithRubric(userInput, RUBRICS.MINI_PITCH);
    
    // Also check if they asked a discovery question
    const painEval = this.evaluateWithRubric(userInput, RUBRICS.UNCOVERING_PAIN);
    
    const evaluation = {
      passed: pitchEval.passed && painEval.passed,
      feedback: pitchEval.passed && painEval.passed ? 
        "Good pitch and great discovery question!" : 
        (!pitchEval.passed ? pitchEval.feedback : painEval.feedback),
      scores: { ...pitchEval.scores, ...painEval.scores },
      overall_score: (pitchEval.overall_score + painEval.overall_score) / 2
    };

    logger.log('📊 Mini pitch evaluation:', evaluation);

    if (!evaluation.passed) {
      // Failed mini pitch
      return {
        success: true,
        response: "Hmm, I don't think we need that. Thanks anyway. *click*",
        evaluation,
        stage: ROLEPLAY_STAGES.MINI_PITCH,
        nextStage: ROLEPLAY_STAGES.HANG_UP,
        shouldHangUp: true
      };
    }

    // Passed - for practice mode, end positively
    if (context.roleplayType === 'opener_practice') {
      return {
        success: true,
        response: "That's interesting. Let me think about it and get back to you. Have a good day!",
        evaluation,
        stage: ROLEPLAY_STAGES.MINI_PITCH,
        nextStage: ROLEPLAY_STAGES.HANG_UP,
        shouldHangUp: true
      };
    }

    // For other modes, continue to post-pitch
    return {
      success: true,
      response: "Tell me more about how this works.",
      evaluation,
      stage: ROLEPLAY_STAGES.MINI_PITCH,
      nextStage: ROLEPLAY_STAGES.POST_PITCH,
      shouldHangUp: false
    };
  }

  // Evaluate user input against a rubric
  evaluateWithRubric(userInput, rubric) {
    const scores = {};
    let passedCriteria = 0;

    // Check each criterion
    for (const criterion of rubric.criteria) {
      const passed = criterion.check(userInput);
      scores[criterion.id] = passed;
      if (passed) passedCriteria++;
    }

    const passed = passedCriteria >= rubric.passThreshold;
    const overall_score = (passedCriteria / rubric.maxScore) * 4;

    // Generate feedback
    let feedback = "";
    if (passed) {
      feedback = `Good ${rubric.name.toLowerCase()}! You met ${passedCriteria} out of ${rubric.maxScore} criteria.`;
    } else {
      feedback = `Keep practicing your ${rubric.name.toLowerCase()}. You only met ${passedCriteria} out of ${rubric.maxScore} criteria.`;
    }

    return {
      passed,
      feedback,
      scores,
      overall_score,
      criteria_met: passedCriteria,
      criteria_total: rubric.maxScore
    };
  }

  // Get random objection
  getRandomObjection(type) {
    const objections = type === 'early' ? EARLY_OBJECTIONS : POST_PITCH_OBJECTIONS;
    const available = objections.filter(obj => !this.usedObjections.has(obj));
    
    if (available.length === 0) {
      this.usedObjections.clear();
      logger.log('🔄 Reset objection list - all were used');
    }
    
    const finalList = available.length > 0 ? available : objections;
    const selected = finalList[Math.floor(Math.random() * finalList.length)];
    this.usedObjections.add(selected);
    this.sessionData.lastObjection = selected;
    
    logger.log('🎭 Selected objection:', selected);
    return selected;
  }

  // Get impatience phrase for silence
  getImpatiencePhrase() {
    return IMPATIENCE_PHRASES[Math.floor(Math.random() * IMPATIENCE_PHRASES.length)];
  }

  // Fallback responses when API fails
  getFallbackResponse(stage) {
    const fallbacks = {
      [ROLEPLAY_STAGES.GREETING]: "Hello?",
      [ROLEPLAY_STAGES.OPENER]: "Yes?",
      [ROLEPLAY_STAGES.EARLY_OBJECTION]: "What's this about?",
      [ROLEPLAY_STAGES.MINI_PITCH]: "Alright, I'm listening.",
      [ROLEPLAY_STAGES.POST_PITCH]: "How do I know this will work for us?",
      [ROLEPLAY_STAGES.QUALIFICATION]: "Tell me more about the implementation.",
      [ROLEPLAY_STAGES.MEETING_ASK]: "I'm pretty busy next week.",
      [ROLEPLAY_STAGES.HANG_UP]: "Alright, thanks for calling."
    };
    
    return fallbacks[stage] || "I'm sorry, what was that?";
  }

  // Start silence timer
  startSilenceTimer() {
    this.silenceStartTime = Date.now();
    logger.log('⏱️ Silence timer started');
  }

  // Reset conversation for new session
  resetConversation() {
    this.conversationHistory = [];
    this.currentStage = ROLEPLAY_STAGES.GREETING;
    this.usedObjections.clear();
    this.sessionData = {};
    this.silenceStartTime = null;
    this.lastUserInput = null;
    logger.log('🔄 OpenAI conversation reset');
  }

  // Handle default/unknown stages
  async handleDefaultStage(userInput, context) {
    return {
      success: true,
      response: "I'm not sure what you mean. Can you clarify?",
      stage: this.currentStage,
      nextStage: this.currentStage,
      shouldHangUp: false
    };
  }

  // Generate coaching feedback
  async generateCoachingFeedback(sessionData) {
    try {
      const evaluations = sessionData.evaluations || [];
      const feedback = {
        sales: "",
        grammar: "",
        vocabulary: "",
        pronunciation: "",
        overall: ""
      };

      // Analyze performance
      const totalScore = evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0);
      const avgScore = evaluations.length > 0 ? totalScore / evaluations.length : 0;

      // Generate feedback based on performance
      if (avgScore >= 3.5) {
        feedback.sales = "Excellent cold calling technique! Keep it up!";
        feedback.overall = "Outstanding performance! You're mastering cold calling.";
      } else if (avgScore >= 2.5) {
        feedback.sales = "Good effort! Focus on being more conversational.";
        feedback.overall = "You're improving! Keep practicing to build confidence.";
      } else {
        feedback.sales = "Keep practicing! Remember to sound natural and empathetic.";
        feedback.overall = "Don't give up! Every call makes you better.";
      }

      feedback.grammar = "Your English grammar is clear - well done!";
      feedback.vocabulary = "Good word choices - keep it simple and clear.";
      feedback.pronunciation = "Speaking clearly - great job!";

      return feedback;

    } catch (error) {
      logger.error('❌ Coaching feedback error:', error);
      
      return {
        sales: "Great job practicing! Keep building confidence with each call.",
        grammar: "Your communication is clear - keep it up!",
        vocabulary: "Use simple, conversational words to connect better.",
        pronunciation: "Speak clearly and at a good pace - you're doing well!",
        overall: "You're improving with each practice session. Keep going!"
      };
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;