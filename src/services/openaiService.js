// src/services/openaiService.js - MORE LENIENT FOR TESTING
import OpenAI from 'openai';
import logger from '../utils/logger';

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

// More lenient rubrics for testing
const RUBRICS = {
  OPENER: {
    criteria: [
      'Greets the prospect (Hi, Hello, etc.)',
      'Mentions own name or company', 
      'Shows some politeness or acknowledgment',
      'Asks a question or shows interest in continuing'
    ],
    passThreshold: 2, // Reduced from 3 to 2 - more lenient
    passIfAny: false
  },
  OBJECTION_HANDLING: {
    criteria: [
      'Acknowledges the objection calmly',
      'Doesn\'t argue immediately',
      'Attempts to continue the conversation', 
      'Shows understanding or empathy'
    ],
    passThreshold: 2, // Reduced from 3 to 2 - more lenient
    passIfAny: false
  },
  MINI_PITCH: {
    criteria: [
      'Mentions a benefit or value proposition',
      'Keeps it relatively brief', 
      'Uses understandable language',
      'Attempts to be relevant'
    ],
    passThreshold: 2, // Reduced from 3 to 2 - more lenient
    passIfAny: false
  },
  UNCOVERING_PAIN: {
    criteria: [
      'Asks a question about the prospect\'s situation',
      'Shows curiosity about their needs',
      'Attempts to understand their challenges'
    ],
    passThreshold: 2, // Keep at 2 but now out of 3
    passIfAny: false
  }
};

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

      // Check API key
      if (!process.env.REACT_APP_OPENAI_API_KEY) {
        throw new Error('OpenAI API key not found');
      }

      // Initialize OpenAI client
      this.client = new OpenAI({
        apiKey: process.env.REACT_APP_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      // Test connection with a simple API call
      try {
        await this.testConnection();
      } catch (testError) {
        logger.warn('OpenAI test connection failed, but continuing:', testError);
        // Continue anyway - might work when actually used
      }

      this.isInitialized = true;
      logger.log('✅ OpenAI service initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ OpenAI service initialization failed:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      logger.log('🧪 Testing OpenAI connection...');
      
      // Simple test call
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
        temperature: 0
      });

      if (response && response.choices && response.choices.length > 0) {
        logger.log('✅ OpenAI connection successful');
        return true;
      } else {
        throw new Error('Invalid response from OpenAI');
      }

    } catch (error) {
      logger.error('❌ OpenAI connection failed:', error);
      throw error;
    }
  }

  // Main method to get AI prospect response following roleplay instructions
  async getProspectResponse(userInput, context, stage = 'greeting') {
    try {
      logger.log('🤖 AI Processing:', { userInput, stage, context: context.roleplayType });
      
      this.currentStage = stage;
      
      // First, evaluate the user's response
      const evaluation = await this.evaluateUserResponse(userInput, stage, context);
      logger.log('📊 Evaluation result:', evaluation);

      // Determine next stage and AI response based on evaluation and stage
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
      return {
        success: false,
        error: error.message,
        response: this.getFallbackResponse(stage),
        evaluation: { passed: false, feedback: 'Technical error occurred' }
      };
    }
  }

  // Determine next action based on current stage and evaluation
  async determineNextAction(userInput, evaluation, stage, context) {
    logger.log('🎯 Determining next action:', { stage, passed: evaluation.passed });

    let objection;
    switch (stage) {
      case 'greeting':
        if (!evaluation.passed) {
          // Be more forgiving - give them another chance instead of hanging up immediately
          logger.log('🎯 Greeting failed, but giving another chance...');
          objection = this.getRandomObjection('early');
          return {
            nextStage: 'early_objection',
            aiResponse: objection,
            shouldHangUp: false
          };
        }

        // Random hang-up check (reduced chance in practice mode)
        if (context.mode === 'marathon' && Math.random() < 0.15) { // Reduced from 0.25 to 0.15
          return {
            nextStage: 'hang_up', 
            aiResponse: "Sorry, got to run.",
            shouldHangUp: true
          };
        }

        // Move to objection stage
        objection = this.getRandomObjection('early');
        return {
          nextStage: 'early_objection',
          aiResponse: objection,
          shouldHangUp: false
        };

      case 'early_objection':
        if (!evaluation.passed) {
          // Give them one more chance before hanging up
          logger.log('🎯 Objection handling failed, but continuing...');
          return {
            nextStage: 'mini_pitch',
            aiResponse: this.getMiniPitchPrompt(),
            shouldHangUp: false
          };
        }

        // Move to mini-pitch stage
        return {
          nextStage: 'mini_pitch',
          aiResponse: this.getMiniPitchPrompt(),
          shouldHangUp: false
        };

      case 'mini_pitch':
        if (!evaluation.passed) {
          // Even if mini-pitch fails, end positively for practice
          return {
            nextStage: 'hang_up',
            aiResponse: "Hmm, let me think about it. Thanks for calling.",
            shouldHangUp: true
          };
        }

        // For practice mode, end call positively
        if (context.roleplayType === 'opener_practice') {
          return {
            nextStage: 'hang_up',
            aiResponse: "That's interesting. Let me think about it and get back to you.",
            shouldHangUp: true
          };
        }

        // For other roleplays, continue conversation
        return {
          nextStage: 'post_pitch',
          aiResponse: "Tell me more about how this works.",
          shouldHangUp: false
        };

      case 'post_pitch':
        // Handle post-pitch conversation (for advanced roleplays)
        return {
          nextStage: 'qualification',
          aiResponse: "Hmm, this might be worth exploring further.",
          shouldHangUp: false
        };

      default:
        return {
          nextStage: 'hang_up',
          aiResponse: "I need to go now. Thanks for calling.",
          shouldHangUp: true
        };
    }
  }

  // Evaluate user response based on rubrics - more lenient version
  async evaluateUserResponse(userInput, stage, context) {
    try {
      const rubric = this.getRubricForStage(stage);
      if (!rubric) {
        return { passed: true, feedback: 'Stage not evaluated', scores: {} };
      }

      logger.log('📋 Evaluating with lenient rubric:', { stage, criteria: rubric.criteria });

      // For testing, use simplified evaluation
      if (process.env.NODE_ENV === 'development') {
        return this.getSimplifiedEvaluation(userInput, stage, rubric);
      }

      const evaluationPrompt = `
You are evaluating a cold call response. Be ENCOURAGING and LENIENT - this is practice for learning.

User Response: "${userInput}"
Current Stage: ${stage}
Roleplay Type: ${context.roleplayType}

RUBRIC FOR ${stage.toUpperCase()} (Be lenient and encouraging):
${rubric.criteria.map((criterion, i) => `${i + 1}. ${criterion}`).join('\n')}

Pass Threshold: Only ${rubric.passThreshold}/${rubric.criteria.length} criteria need to be met

EVALUATION RULES:
- Be encouraging and supportive
- Look for ANY effort to communicate naturally
- Give credit for trying
- Focus on what they did right
- If they show any basic communication skills, pass them

Provide evaluation in this exact JSON format:
{
  "passed": boolean,
  "feedback": "encouraging feedback in simple English (max 40 words)",
  "scores": {
    "criterion1": boolean,
    "criterion2": boolean,
    "criterion3": boolean,
    "criterion4": boolean
  },
  "overall_score": number (1-4),
  "strengths": ["what they did well"],
  "improvements": ["gentle suggestions"]
}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use cheaper model for evaluation
        messages: [{ role: 'user', content: evaluationPrompt }],
        temperature: 0.3, // Slightly more creative
        max_tokens: 400
      });

      let evaluation;
      try {
        evaluation = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        logger.error('JSON parse error:', parseError);
        return this.getFallbackEvaluation(userInput, stage);
      }
      
      // Ensure passed status matches rubric threshold (lenient)
      const passedCriteria = Object.values(evaluation.scores).filter(Boolean).length;
      evaluation.passed = passedCriteria >= rubric.passThreshold;

      // Be extra lenient - if they made any reasonable attempt, pass them
      if (!evaluation.passed && userInput.length > 5) {
        logger.log('🎯 Being extra lenient - user made an effort');
        evaluation.passed = true;
        evaluation.feedback = "Good effort! Keep practicing to improve your cold calling skills.";
      }

      logger.log('✅ Evaluation complete:', { 
        passed: evaluation.passed, 
        score: evaluation.overall_score,
        passedCriteria: `${passedCriteria}/${rubric.criteria.length}`
      });

      return evaluation;

    } catch (error) {
      logger.error('❌ Evaluation error:', error);
      return this.getFallbackEvaluation(userInput, stage);
    }
  }

  // Simplified evaluation for development/testing
  getSimplifiedEvaluation(userInput, stage, rubric) {
    const input = userInput.toLowerCase().trim();
    
    // Very lenient evaluation - focus on basic effort
    let passed = false;
    let feedback = "";
    let score = 1;

    if (input.length < 3) {
      passed = false;
      feedback = "Try saying a bit more - even a simple greeting works!";
      score = 1;
    } else {
      switch (stage) {
        case 'greeting':
          // Pass if they say anything greeting-like or introduce themselves
          passed = input.includes('hi') || input.includes('hello') || input.includes('hey') ||
                   input.includes('good') || input.includes('name') || input.includes('calling') ||
                   input.includes('this is') || input.length > 10;
          feedback = passed ? "Nice greeting! You're connecting with the prospect." : "Good try! Try introducing yourself next time.";
          score = passed ? 3 : 2;
          break;
          
        case 'early_objection':
          // Pass if they acknowledge or try to continue the conversation
          passed = input.includes('understand') || input.includes('appreciate') || 
                   input.includes('get that') || input.includes('fair') || input.includes('know') ||
                   input.includes('minute') || input.includes('second') || input.length > 15;
          feedback = passed ? "Good job handling the objection!" : "Nice effort! Try acknowledging their concern first.";
          score = passed ? 3 : 2;
          break;
          
        case 'mini_pitch':
          // Pass if they mention any value or benefit
          passed = input.length > 20; // Just needs to be substantial
          feedback = passed ? "Great pitch! You're explaining your value." : "Good start! Try explaining what you offer.";
          score = passed ? 3 : 2;
          break;
          
        default:
          passed = input.length > 5;
          feedback = "Good effort! Keep practicing to improve.";
          score = passed ? 2.5 : 2;
      }
    }

    return {
      passed,
      feedback,
      scores: { 
        criterion1: passed, 
        criterion2: passed, 
        criterion3: false, 
        criterion4: false 
      },
      overall_score: score,
      strengths: [passed ? "Making an effort to communicate" : "Trying to engage"],
      improvements: ["Keep practicing", "Be more specific"]
    };
  }

  // Get rubric for specific stage
  getRubricForStage(stage) {
    const stageRubricMap = {
      greeting: RUBRICS.OPENER,
      early_objection: RUBRICS.OBJECTION_HANDLING,
      mini_pitch: RUBRICS.MINI_PITCH,
      uncovering_pain: RUBRICS.UNCOVERING_PAIN
    };
    
    return stageRubricMap[stage];
  }

  // Get random objection (avoiding repeats within session)
  getRandomObjection(type) {
    const objections = type === 'early' ? EARLY_OBJECTIONS : POST_PITCH_OBJECTIONS;
    const available = objections.filter(obj => !this.usedObjections.has(obj));
    
    if (available.length === 0) {
      this.usedObjections.clear(); // Reset if all used
      logger.log('🔄 Reset objection list - all were used');
    }
    
    const finalList = available.length > 0 ? available : objections;
    const selected = finalList[Math.floor(Math.random() * finalList.length)];
    this.usedObjections.add(selected);
    this.sessionData.lastObjection = selected;
    
    logger.log('🎭 Selected objection:', selected);
    return selected;
  }

  // Get mini-pitch prompt
  getMiniPitchPrompt() {
    const prompts = [
      "Alright, I'm listening. What is it?",
      "You've got 30 seconds.",
      "Okay, tell me more.",
      "Go ahead, what's this about?",
      "I'm listening."
    ];
    
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  // More lenient fallback evaluation
  getFallbackEvaluation(userInput, stage) {
    const input = userInput.toLowerCase();
    
    // Much more lenient fallback
    let passed = input.length > 5; // Just needs some effort
    
    return {
      passed,
      feedback: passed ? "Good effort! Keep practicing to improve your skills." : "Try saying a bit more to engage the prospect.",
      scores: { criterion1: passed, criterion2: passed, criterion3: false, criterion4: false },
      overall_score: passed ? 2.5 : 2,
      strengths: ["Making an effort"],
      improvements: ["Keep practicing", "Be more specific"]
    };
  }

  // Get impatience phrase for silence
  getImpatiencePhrase() {
    return IMPATIENCE_PHRASES[Math.floor(Math.random() * IMPATIENCE_PHRASES.length)];
  }

  // Fallback responses when API fails
  getFallbackResponse(stage) {
    const fallbacks = {
      greeting: "Hello?",
      early_objection: "What's this about?",
      mini_pitch: "Alright, I'm listening.",
      post_pitch: "How do I know this will work for us?",
      qualification: "Tell me more about the implementation.",
      meeting_ask: "I'm pretty busy next week.",
      hang_up: "Alright, thanks for calling."
    };
    
    return fallbacks[stage] || "I'm sorry, what was that?";
  }

  // Generate coaching feedback
  async generateCoachingFeedback(sessionData) {
    try {
      const prompt = `
Create encouraging coaching feedback for this cold calling practice:

Session: ${sessionData.roleplayType}
Calls: ${sessionData.callsAttempted} 
Passed: ${sessionData.callsPassed}
Average Score: ${sessionData.averageScore}

Be encouraging and supportive. Use simple English. Max 15 words per tip.

Format as JSON:
{
  "sales": "encouraging sales tip",
  "grammar": "grammar feedback or praise",
  "vocabulary": "vocabulary tip or praise", 
  "pronunciation": "pronunciation tip or praise",
  "overall": "encouraging summary"
}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      logger.error('❌ Coaching feedback error:', error);
      
      // Fallback coaching
      return {
        sales: "Great job practicing! Keep building confidence with each call.",
        grammar: "Your communication is clear - keep it up!",
        vocabulary: "Use simple, conversational words to connect better.",
        pronunciation: "Speak clearly and at a good pace - you're doing well!",
        overall: "You're improving with each practice session. Keep going!"
      };
    }
  }

  // Reset conversation for new session
  resetConversation() {
    this.conversationHistory = [];
    this.currentStage = 'greeting';
    this.usedObjections.clear();
    this.sessionData = {};
    logger.log('🔄 OpenAI conversation reset');
  }

  // Check if should random hang-up (for marathon mode) - reduced chance
  shouldRandomHangUp(mode = 'practice') {
    if (mode === 'marathon' && Math.random() < 0.15) { // Reduced from 0.25 to 0.15
      logger.log('🎲 Random hang-up triggered');
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;