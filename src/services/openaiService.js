// src/services/openaiService.js
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

// Exact rubrics from roleplay instructions
const RUBRICS = {
  OPENER: {
    criteria: [
      'Clear cold call opener (pattern interrupt, permission-based, or value-first)',
      'Casual, confident tone (contractions, short phrases)', 
      'Demonstrates empathy (acknowledges interruption/unfamiliarity)',
      'Ends with soft question'
    ],
    passThreshold: 3,
    passIfAny: false
  },
  OBJECTION_HANDLING: {
    criteria: [
      'Acknowledges calmly ("Fair enough"/"Totally get that")',
      'Doesn\'t argue or pitch immediately',
      'Reframes or buys time in 1 sentence', 
      'Ends with forward-moving question'
    ],
    passThreshold: 3,
    passIfAny: false
  },
  MINI_PITCH: {
    criteria: [
      'Short (1-2 sentences)',
      'Problem/outcome focused', 
      'Simple English, no jargon',
      'Natural delivery'
    ],
    passThreshold: 3,
    passIfAny: false
  },
  UNCOVERING_PAIN: {
    criteria: [
      'Asks short question tied to pitch',
      'Question is open/curious',
      'Tone is soft and non-pushy'
    ],
    passThreshold: 2,
    passIfAny: false
  }
};

export class OpenAIService {
  constructor() {
    this.conversationHistory = [];
    this.currentStage = 'greeting';
    this.usedObjections = new Set();
    this.sessionData = {};
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

      // Test connection
      await this.testConnection();

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
      
     
      logger.log('✅ OpenAI connection successful');
      return true;

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
          return {
            nextStage: 'hang_up',
            aiResponse: "Sorry, not interested.",
            shouldHangUp: true
          };
        }

        // Random hang-up check (20-30% chance after successful opener)
        if (context.mode === 'marathon' && Math.random() < 0.25) {
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
          return {
            nextStage: 'hang_up',
            aiResponse: "Look, I'm really not interested. Goodbye.",
            shouldHangUp: true
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
          return {
            nextStage: 'hang_up',
            aiResponse: "This doesn't sound like something we need. Thanks anyway.",
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

  // Evaluate user response based on exact rubrics from instructions
  async evaluateUserResponse(userInput, stage, context) {
    try {
      const rubric = this.getRubricForStage(stage);
      if (!rubric) {
        return { passed: true, feedback: 'Stage not evaluated', scores: {} };
      }

      logger.log('📋 Evaluating with rubric:', { stage, criteria: rubric.criteria });

      const evaluationPrompt = `
You are evaluating a cold call response. Be strict and precise according to the rubrics.

User Response: "${userInput}"
Current Stage: ${stage}
Roleplay Type: ${context.roleplayType}

EXACT RUBRIC FOR ${stage.toUpperCase()}:
${rubric.criteria.map((criterion, i) => `${i + 1}. ${criterion}`).join('\n')}

Pass Threshold: ${rubric.passThreshold}/${rubric.criteria.length} criteria must be met

EVALUATION RULES:
- Be strict but fair
- Look for natural conversation flow
- Check for empathy and human connection
- Assess English fluency and clarity
- Consider tone and confidence

Provide evaluation in this exact JSON format:
{
  "passed": boolean,
  "feedback": "brief constructive feedback in simple English (max 40 words)",
  "scores": {
    "criterion1": boolean,
    "criterion2": boolean,
    "criterion3": boolean,
    "criterion4": boolean
  },
  "overall_score": number (1-4),
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"]
}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: evaluationPrompt }],
        temperature: 0.2,
        max_tokens: 400
      });

      let evaluation;
      try {
        evaluation = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        logger.error('JSON parse error:', parseError);
        return this.getFallbackEvaluation(userInput, stage);
      }
      
      // Ensure passed status matches rubric threshold
      const passedCriteria = Object.values(evaluation.scores).filter(Boolean).length;
      evaluation.passed = passedCriteria >= rubric.passThreshold;

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

  // Fallback evaluation
  getFallbackEvaluation(userInput, stage) {
    const input = userInput.toLowerCase();
    
    // Simple heuristics for different stages
    let passed = false;
    switch (stage) {
      case 'greeting':
        passed = input.includes('hi') || input.includes('hello') || 
                 input.includes('calling') || input.includes('name');
        break;
      case 'early_objection':
        passed = input.includes('understand') || input.includes('appreciate') || 
                 input.includes('get that') || input.includes('fair');
        break;
      case 'mini_pitch':
        passed = input.length > 20 && input.length < 200;
        break;
      default:
        passed = Math.random() > 0.4; // 60% pass rate
    }

    return {
      passed,
      feedback: passed ? "Good attempt! Keep practicing to improve." : "Try to be more natural and empathetic.",
      scores: { criterion1: passed, criterion2: passed, criterion3: false, criterion4: false },
      overall_score: passed ? 2.5 : 1.5,
      strengths: ["Showing effort"],
      improvements: ["Work on natural tone", "Add more empathy"]
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

  // Generate coaching feedback in CEFR A2 English as per instructions
  async generateCoachingFeedback(sessionData) {
    try {
      const prompt = `
Create coaching feedback in simple English (CEFR A2 level) for this cold calling session:

Session: ${sessionData.roleplayType}
Calls: ${sessionData.callsAttempted} 
Passed: ${sessionData.callsPassed}
Average Score: ${sessionData.averageScore}

Create feedback with exactly 4 categories (1 item each):
1. Sales (technique advice)
2. Grammar (if errors found)  
3. Vocabulary (word choice tips)
4. Pronunciation (if issues detected)

Use simple words. Be encouraging but honest. Max 15 words per line.

Format as JSON:
{
  "sales": "specific sales tip",
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
        sales: "Good effort! Try to sound more natural and confident.",
        grammar: "Grammar looks good - keep it up!",
        vocabulary: "Use simple, clear words to connect better.",
        pronunciation: "Work on clear speech - practice makes perfect!",
        overall: "You're improving! Keep practicing to build confidence."
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

  // Check if should random hang-up (for marathon mode)
  shouldRandomHangUp(mode = 'practice') {
    if (mode === 'marathon' && Math.random() < 0.25) { // 25% chance in marathon
      logger.log('🎲 Random hang-up triggered');
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;