// src/services/openaiService.js - VERY LENIENT VERSION FOR TESTING
import OpenAI from 'openai';
import logger from '../utils/logger';

// Objection libraries
const EARLY_OBJECTIONS = [
  "What's this about?",
  "I'm not interested",
  "We don't take cold calls",
  "Now is not a good time",
  "I have a meeting",
  "Can you call me later?",
  "Send me an email",
  "Who gave you this number?",
  "What are you trying to sell me?",
  "Is this a sales call?"
];

const IMPATIENCE_PHRASES = [
  "Hello? Are you still with me?",
  "Can you hear me?",
  "Still on the line?",
  "I don't have much time for this."
];

export class OpenAIService {
  constructor() {
    this.conversationHistory = [];
    this.currentStage = 'greeting';
    this.usedObjections = new Set();
    this.sessionData = {};
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) return true;

      logger.log('🤖 Initializing OpenAI service...');

      if (!process.env.REACT_APP_OPENAI_API_KEY) {
        logger.warn('⚠️ OpenAI API key not found - using mock responses');
        this.useMockMode = true;
      } else {
        this.client = new OpenAI({
          apiKey: process.env.REACT_APP_OPENAI_API_KEY,
          dangerouslyAllowBrowser: true
        });
        this.useMockMode = false;
      }

      this.isInitialized = true;
      logger.log('✅ OpenAI service initialized');
      return true;

    } catch (error) {
      logger.error('❌ OpenAI service initialization failed:', error);
      this.useMockMode = true;
      this.isInitialized = true;
      return true;
    }
  }

  // Main method to get AI prospect response
  async getProspectResponse(userInput, context, stage = 'greeting') {
    try {
      logger.log('🤖 AI Processing:', { userInput, stage, context: context.roleplayType });
      
      this.currentStage = stage;
      
      // Handle silence
      if (!userInput || userInput.trim() === '') {
        return {
          success: true,
          response: this.getImpatiencePhrase(),
          stage,
          nextStage: stage,
          shouldHangUp: false
        };
      }

      // VERY LENIENT evaluation - almost always pass
      const evaluation = this.getLenientEvaluation(userInput, stage);
      logger.log('📊 Lenient evaluation:', evaluation);

      // Determine next action
      const { nextStage, aiResponse, shouldHangUp } = await this.determineNextAction(
        userInput, 
        evaluation, 
        stage, 
        context
      );

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: userInput },
        { role: 'assistant', content: aiResponse }
      );

      return {
        success: true,
        response: aiResponse,
        evaluation,
        stage,
        nextStage,
        shouldHangUp,
        objectionUsed: this.sessionData.lastObjection
      };

    } catch (error) {
      logger.error('❌ OpenAI API error:', error);
      // Use fallback responses
      return {
        success: true,
        response: this.getFallbackResponse(stage),
        evaluation: { passed: true, feedback: 'Good effort!' },
        stage,
        nextStage: this.getNextStage(stage),
        shouldHangUp: false
      };
    }
  }

  // VERY lenient evaluation - almost always passes
  getLenientEvaluation(userInput, stage) {
    const input = userInput.toLowerCase().trim();
    
    // Always pass if they said something reasonable (more than 2 words)
    if (input.split(/\s+/).length > 2) {
      return {
        passed: true,
        feedback: this.getPositiveFeedback(stage),
        scores: { all: true },
        overall_score: 3.5,
        strengths: ["Good communication", "Clear speaking"],
        improvements: []
      };
    }

    // Even for very short responses, be encouraging
    return {
      passed: true,
      feedback: "Good start! Try adding a bit more detail next time.",
      scores: { partial: true },
      overall_score: 3.0,
      strengths: ["Making an effort"],
      improvements: ["Add more detail"]
    };
  }

  // Get positive feedback for stage
  getPositiveFeedback(stage) {
    const feedback = {
      greeting: "Great opening! You sound confident and friendly.",
      opener: "Excellent introduction! You're building rapport nicely.",
      early_objection: "Good job handling that objection calmly.",
      mini_pitch: "Nice pitch! Clear and to the point.",
      default: "Well done! You're doing great."
    };
    
    return feedback[stage] || feedback.default;
  }

  // Determine next action - always progress forward
  async determineNextAction(userInput, evaluation, stage, context) {
    logger.log('🎯 Determining next action:', { stage, passed: evaluation.passed });

    // Always progress to next stage
    switch (stage) {
      case 'greeting':
        return {
          nextStage: 'opener',
          aiResponse: "Hello?",
          shouldHangUp: false
        };

      case 'opener':
        // Never random hang up in practice mode
        const objection = this.getRandomObjection('early');
        return {
          nextStage: 'early_objection',
          aiResponse: objection,
          shouldHangUp: false
        };

      case 'early_objection':
        return {
          nextStage: 'mini_pitch',
          aiResponse: "Alright, I'm listening. What is it?",
          shouldHangUp: false
        };

      case 'mini_pitch':
        // For practice mode, end positively
        if (context.roleplayType === 'opener_practice') {
          return {
            nextStage: 'hang_up',
            aiResponse: "That sounds interesting. Let me think about it and I'll get back to you. Have a great day!",
            shouldHangUp: true
          };
        }
        
        return {
          nextStage: 'post_pitch',
          aiResponse: "Tell me more about how this works.",
          shouldHangUp: false
        };

      default:
        return {
          nextStage: 'hang_up',
          aiResponse: "Thanks for calling. Have a great day!",
          shouldHangUp: true
        };
    }
  }

  // Get next stage
  getNextStage(currentStage) {
    const stageFlow = {
      greeting: 'opener',
      opener: 'early_objection',
      early_objection: 'mini_pitch',
      mini_pitch: 'post_pitch',
      post_pitch: 'qualification',
      qualification: 'meeting_ask',
      meeting_ask: 'wrap_up',
      wrap_up: 'hang_up'
    };
    
    return stageFlow[currentStage] || 'hang_up';
  }

  // Get random objection
  getRandomObjection(type) {
    const objections = EARLY_OBJECTIONS;
    const available = objections.filter(obj => !this.usedObjections.has(obj));
    
    if (available.length === 0) {
      this.usedObjections.clear();
    }
    
    const finalList = available.length > 0 ? available : objections;
    const selected = finalList[Math.floor(Math.random() * finalList.length)];
    this.usedObjections.add(selected);
    this.sessionData.lastObjection = selected;
    
    logger.log('🎭 Selected objection:', selected);
    return selected;
  }

  // Get impatience phrase
  getImpatiencePhrase() {
    return IMPATIENCE_PHRASES[Math.floor(Math.random() * IMPATIENCE_PHRASES.length)];
  }

  // Fallback responses
  getFallbackResponse(stage) {
    const fallbacks = {
      greeting: "Hello?",
      opener: "Yes, what can I help you with?",
      early_objection: "What's this about?",
      mini_pitch: "Okay, tell me more.",
      post_pitch: "How does that work exactly?",
      qualification: "Interesting. What companies do you work with?",
      meeting_ask: "I might be interested. When were you thinking?",
      hang_up: "Thanks for calling!"
    };
    
    return fallbacks[stage] || "Can you tell me more?";
  }

  // Generate coaching feedback - always positive
  async generateCoachingFeedback(sessionData) {
    return {
      sales: "Great job! Your communication was clear and professional.",
      grammar: "Your English is excellent - keep it up!",
      vocabulary: "Good word choices throughout the call.",
      pronunciation: "Speaking clearly - well done!",
      overall: "Excellent practice session! You're improving with each call."
    };
  }

  // Reset conversation
  resetConversation() {
    this.conversationHistory = [];
    this.currentStage = 'greeting';
    this.usedObjections.clear();
    this.sessionData = {};
    logger.log('🔄 OpenAI conversation reset');
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;