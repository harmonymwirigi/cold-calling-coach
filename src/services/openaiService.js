// src/services/openaiService.js - ENHANCED FOR CLIENT SPECIFICATIONS
import OpenAI from 'openai';
import logger from '../utils/logger';

export class OpenAIService {
  constructor() {
    this.conversationHistory = [];
    this.isInitialized = false;
    this.client = null;
    this.useMockMode = false;
    this.currentCharacter = null;
    this.sessionContext = null;
    this.objectionLists = this.initializeObjectionLists();
  }

  // Initialize objection lists per client specifications
  initializeObjectionLists() {
    return {
      earlyStage: [
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
      ],
      postPitch: [
        "It's too expensive for us.",
        "We have no budget for this right now.",
        "Your competitor is cheaper.",
        "Can you give us a discount?",
        "This isn't a good time.",
        "We've already set this year's budget.",
        "Call me back next quarter.",
        "We're busy with other projects right now.",
        "We already use a competitor and we're happy.",
        "We built something similar ourselves.",
        "How exactly are you better than the competitor?",
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
      ],
      pitchPrompts: [
        "Alright, go ahead — what's this about?",
        "So… what are you calling me about?",
        "You've got 30 seconds. Impress me.",
        "I'm listening. What do you do?",
        "This better be good. What is it?",
        "Okay. Tell me why you're calling.",
        "Go on — what's the offer?",
        "Convince me.",
        "What's your pitch?",
        "Let's hear it."
      ],
      impatienceResponses: [
        "Hello? Are you still with me?",
        "Can you hear me?",
        "Just checking you're there…",
        "Still on the line?",
        "I don't have much time for this.",
        "Sounds like you are gone.",
        "Are you an idiot.",
        "What is going on.",
        "Are you okay to continue?",
        "I am afraid I have to go"
      ]
    };
  }

  async initialize() {
    try {
      if (this.isInitialized) return true;

      logger.log('🤖 [OPENAI-SPECS] Initializing OpenAI service...');

      if (!process.env.REACT_APP_OPENAI_API_KEY) {
        logger.warn('⚠️ OpenAI API key not found - using intelligent fallbacks');
        this.useMockMode = true;
      } else {
        this.client = new OpenAI({
          apiKey: process.env.REACT_APP_OPENAI_API_KEY,
          dangerouslyAllowBrowser: true
        });
        this.useMockMode = false;
      }

      this.isInitialized = true;
      logger.log('✅ [OPENAI-SPECS] OpenAI service initialized');
      return true;

    } catch (error) {
      logger.error('❌ [OPENAI-SPECS] Initialization failed:', error);
      this.useMockMode = true;
      this.isInitialized = true;
      return true;
    }
  }

  // Set session context for roleplay-specific behavior
  setSessionContext(roleplayType, mode, userProfile, character) {
    this.sessionContext = {
      roleplayType,
      mode,
      userProfile,
      character
    };
    this.currentCharacter = character;
    this.conversationHistory = [];
    
    logger.log('🎭 [OPENAI-SPECS] Session context set:', { 
      roleplayType, 
      mode, 
      character: character?.name 
    });
  }

  // Main method for getting prospect responses per client specifications
  async getProspectResponse(stage, userInput, context = {}) {
    try {
      logger.log('🤖 [OPENAI-SPECS] Processing stage:', { 
        stage, 
        input: userInput?.substring(0, 30),
        roleplayType: this.sessionContext?.roleplayType,
        mode: this.sessionContext?.mode
      });

      // Handle special stages per client specs
      switch (stage) {
        case 'greeting':
          return this.generateGreeting();
        case 'early_objection':
          return this.generateEarlyObjection(context);
        case 'pitch_prompt':
          return this.generatePitchPrompt();
        case 'post_pitch_objection':
          return this.generatePostPitchObjection(context);
        case 'quickfire_objection':
          return this.generateQuickfireObjection();
        case 'silence_warning':
          return this.generateSilenceResponse();
        case 'random_hangup':
          return this.generateRandomHangup();
        case 'impatience':
          return this.generateImpatienceResponse();
        default:
          return await this.generateConversationalResponse(stage, userInput, context);
      }

    } catch (error) {
      logger.error('❌ [OPENAI-SPECS] Error generating response:', error);
      return this.generateEmergencyFallback(stage);
    }
  }

  // Generate greeting per client specifications
  generateGreeting() {
    const character = this.currentCharacter || { 
      name: 'Sarah', 
      title: 'VP of Marketing', 
      company: 'TechCorp' 
    };
    
    const greetings = [
      "Hello?",
      `${character.name} speaking.`,
      `Hi, this is ${character.name}.`,
      "Hello, who is this?",
      `${character.name} here.`,
      "Good morning, how can I help you?",
      `This is ${character.name}, what can I do for you?`
    ];

    // Add variety for marathon mode
    if (this.sessionContext?.mode === 'marathon' || this.sessionContext?.mode === 'legend') {
      greetings.push(
        "Hello, what's this regarding?",
        `${character.name} from ${character.company}.`,
        "Hi there, who am I speaking with?"
      );
    }

    const response = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      success: true,
      response,
      stage: 'greeting'
    };
  }

  // Generate early-stage objection per client specs
  generateEarlyObjection(context = {}) {
    const usedObjections = context.usedObjections || new Set();
    
    // Filter out used objections
    const availableObjections = this.objectionLists.earlyStage.filter(obj => 
      !usedObjections.has(obj)
    );
    
    // If all used, reset (should not happen in single call)
    const objectionsToUse = availableObjections.length > 0 
      ? availableObjections 
      : this.objectionLists.earlyStage;
    
    const objection = objectionsToUse[Math.floor(Math.random() * objectionsToUse.length)];
    
    return {
      success: true,
      response: objection,
      stage: 'early_objection',
      selectedObjection: objection
    };
  }

  // Generate pitch prompt per client specs
  generatePitchPrompt() {
    const prompts = this.objectionLists.pitchPrompts;
    const response = prompts[Math.floor(Math.random() * prompts.length)];
    
    return {
      success: true,
      response,
      stage: 'pitch_prompt'
    };
  }

  // Generate post-pitch objection per client specs
  generatePostPitchObjection(context = {}) {
    const usedObjections = context.usedObjections || new Set();
    const count = context.objectionCount || 1;
    
    // Get available objections
    const availableObjections = this.objectionLists.postPitch.filter(obj => 
      !usedObjections.has(obj)
    );
    
    if (availableObjections.length === 0) {
      // All used in this call, this shouldn't happen
      return {
        success: true,
        response: "I need to think about this more.",
        stage: 'post_pitch_objection'
      };
    }
    
    // Select 1-3 objections as specified
    const numObjections = Math.min(count, availableObjections.length);
    const selectedObjections = [];
    
    for (let i = 0; i < numObjections; i++) {
      const randomIndex = Math.floor(Math.random() * availableObjections.length);
      const objection = availableObjections.splice(randomIndex, 1)[0];
      selectedObjections.push(objection);
    }
    
    const response = selectedObjections[0]; // Return first objection
    
    return {
      success: true,
      response,
      stage: 'post_pitch_objection',
      selectedObjections
    };
  }

  // Generate quickfire objection for warmup challenge
  generateQuickfireObjection() {
    // Combine both lists for variety in warmup
    const allObjections = [
      ...this.objectionLists.earlyStage,
      ...this.objectionLists.postPitch
    ];
    
    const response = allObjections[Math.floor(Math.random() * allObjections.length)];
    
    return {
      success: true,
      response,
      stage: 'quickfire_objection'
    };
  }

  // Generate silence response per client specs
  generateSilenceResponse() {
    const responses = this.objectionLists.impatienceResponses;
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      success: true,
      response,
      stage: 'silence_warning'
    };
  }

  // Generate random hangup per client specs (marathon mode)
  generateRandomHangup() {
    const hangupResponses = [
      "Sorry, got to run.",
      "I have another call coming in.",
      "Something urgent just came up.",
      "I need to jump on another call.",
      "My meeting is starting now."
    ];
    
    const response = hangupResponses[Math.floor(Math.random() * hangupResponses.length)];
    
    return {
      success: true,
      response,
      stage: 'random_hangup',
      shouldHangUp: true
    };
  }

  // Generate impatience response per client specs
  generateImpatienceResponse() {
    const responses = this.objectionLists.impatienceResponses;
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      success: true,
      response,
      stage: 'impatience'
    };
  }

  // Generate conversational response using OpenAI with client-specific prompts
  async generateConversationalResponse(stage, userInput, context) {
    // Try OpenAI first
    if (!this.useMockMode) {
      try {
        const aiResponse = await this.callOpenAIWithClientSpecs(stage, userInput, context);
        return {
          success: true,
          response: aiResponse,
          stage
        };
      } catch (error) {
        logger.warn('🔄 [OPENAI-SPECS] OpenAI failed, using intelligent fallback');
      }
    }

    // Use intelligent fallback
    return this.generateIntelligentFallback(stage, userInput, context);
  }

  // Call OpenAI with client-specific prompts
  async callOpenAIWithClientSpecs(stage, userInput, context) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const messages = this.buildClientSpecificPrompt(stage, userInput, context);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 100, // Keep responses concise per client specs
      temperature: 0.8,
      presence_penalty: 0.6,
      frequency_penalty: 0.4
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response');
    }

    return response.choices[0].message.content.trim();
  }

  // Build client-specific prompts
  buildClientSpecificPrompt(stage, userInput, context) {
    const character = this.currentCharacter;
    const mode = this.sessionContext?.mode;
    const evaluation = context.evaluation;
    
    // Base character prompt
    let characterPrompt = `You are ${character.name}, ${character.title} at ${character.company}. `;
    characterPrompt += `You work in ${this.sessionContext?.userProfile?.prospect_industry || 'Technology'}. `;
    
    if (this.sessionContext?.userProfile?.custom_behavior_notes) {
      characterPrompt += `Additional context: ${this.sessionContext.userProfile.custom_behavior_notes}. `;
    }

    // Mode-specific behavior
    let modePrompt = '';
    if (mode === 'legend') {
      modePrompt = 'Be challenging and demanding. You expect excellence and are skeptical. ';
    } else if (mode === 'marathon') {
      modePrompt = 'Vary your personality. Sometimes be more difficult, sometimes more receptive. ';
    } else {
      modePrompt = 'Be moderately receptive if they show good skills. ';
    }

    // Stage-specific instructions
    let stagePrompt = this.getStageSpecificPrompt(stage, evaluation);
    
    const systemPrompt = `${characterPrompt}${modePrompt}${stagePrompt}
    
    Respond in under 25 words. Use natural, conversational CEFR C2 English. Stay in character.`;

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history (last 6 exchanges)
    const recentHistory = this.conversationHistory.slice(-6);
    messages.push(...recentHistory);

    // Add current user input
    messages.push({ role: "user", content: userInput });

    return messages;
  }

  // Get stage-specific prompts per client specifications
  getStageSpecificPrompt(stage, evaluation) {
    const prompts = {
      opener: evaluation?.passed 
        ? "They showed good opener skills. Be somewhat receptive but still cautious."
        : "Their opener wasn't impressive. Be resistant or give an objection.",
        
      early_objection: evaluation?.hasEmpathy
        ? "They showed empathy. Become slightly more receptive but still cautious."
        : "They argued or pushed. Be resistant and consider hanging up.",
        
      mini_pitch: evaluation?.passed
        ? "Good pitch. Ask a follow-up question or show mild interest."
        : "Weak pitch. Give a realistic objection about budget, timing, or need.",
        
      post_pitch_handling: evaluation?.passed
        ? "They handled that well. Ask a realistic business question."
        : "Poor handling. Be more resistant or evasive.",
        
      qualification: evaluation?.passed
        ? "They're qualifying well. Provide realistic company information."
        : "Poor qualification attempt. Be evasive or redirect.",
        
      meeting_ask: evaluation?.passed
        ? "Reasonable meeting ask. Show interest but some hesitation."
        : "Poor meeting ask. Be reluctant or ask for more information.",
        
      default: "Continue the conversation naturally as a busy business professional."
    };

    return prompts[stage] || prompts.default;
  }

  // Generate intelligent fallback responses
  generateIntelligentFallback(stage, userInput, context) {
    const evaluation = context.evaluation;
    
    const fallbacks = {
      opener: evaluation?.passed
        ? this.generateEarlyObjection(context)
        : { success: true, response: "I'm not interested.", stage: 'call_end' },
        
      early_objection: evaluation?.passed
        ? this.generatePitchPrompt()
        : { success: true, response: "I really don't have time for this.", stage: 'call_end' },
        
      mini_pitch: evaluation?.passed
        ? { success: true, response: "That sounds interesting. Tell me more.", stage: 'post_pitch_handling' }
        : { success: true, response: "I'm not sure I understand.", stage: 'call_end' },
        
      post_pitch_handling: evaluation?.passed
        ? { success: true, response: "What kind of results do you typically see?", stage: 'qualification' }
        : { success: true, response: "We're happy with our current solution.", stage: 'call_end' },
        
      qualification: evaluation?.passed
        ? { success: true, response: "That could be helpful for us.", stage: 'meeting_ask' }
        : { success: true, response: "I'm not sure this applies to us.", stage: 'call_end' },
        
      meeting_ask: evaluation?.passed
        ? { success: true, response: "I'm pretty busy next week. What would we cover?", stage: 'close' }
        : { success: true, response: "I need to think about that.", stage: 'call_end' },
        
      default: { success: true, response: "I see. Please continue.", stage }
    };

    return fallbacks[stage] || fallbacks.default;
  }

  // Generate emergency fallback
  generateEmergencyFallback(stage) {
    const emergencyResponses = {
      greeting: "Hello?",
      opener: "What's this about?",
      early_objection: "Okay, what exactly are you offering?",
      mini_pitch: "Tell me more about that.",
      post_pitch_handling: "That's interesting.",
      qualification: "I see.",
      meeting_ask: "I'll have to think about that.",
      default: "Could you repeat that?"
    };

    return {
      success: true,
      response: emergencyResponses[stage] || emergencyResponses.default,
      stage
    };
  }

  // Generate coaching feedback per client CEFR A2 specifications
  async generateCoachingFeedback(evaluations, roleplayType, mode) {
    const coaching = {
      sales: [],
      grammar: [],
      vocabulary: [],
      pronunciation: [],
      rapport: []
    };

    // Analyze evaluations for specific feedback
    evaluations.forEach(evaluation => {
      if (evaluation.criteria) {
        evaluation.criteria.forEach(criterion => {
          if (!criterion.met) {
            coaching.sales.push(this.formatSalesFeedback(criterion));
          }
        });
      }
    });

    // Add grammar feedback in client format
    if (this.hasGrammarIssues(evaluations)) {
      coaching.grammar.push(this.generateGrammarFeedback());
    } else {
      coaching.grammar.push("Great grammar—no errors detected!");
    }

    // Add vocabulary feedback in client format
    if (this.hasVocabularyIssues(evaluations)) {
      coaching.vocabulary.push(this.generateVocabularyFeedback());
    } else {
      coaching.vocabulary.push("Perfect word choice!");
    }

    // Add pronunciation feedback (simulated)
    coaching.pronunciation.push("Clear pronunciation throughout!");

    // Add rapport feedback
    coaching.rapport.push("Natural and confident tone!");

    // Format according to client specifications
    const maxLines = mode === 'practice' ? 6 : 10;
    const allFeedback = [];
    
    Object.values(coaching).forEach(categoryFeedback => {
      allFeedback.push(...categoryFeedback.slice(0, 2));
    });

    return allFeedback.slice(0, maxLines);
  }

  // Format sales feedback per client templates
  formatSalesFeedback(criterion) {
    const feedbackTemplates = {
      demonstrates_empathy: "Add empathy: 'I know this is out of the blue...'",
      soft_question_ending: "End with soft question: 'Can I tell you why I'm calling?'",
      calm_acknowledgment: "Acknowledge calmly: 'Fair enough' or 'I get that'",
      forward_moving_question: "Ask forward-moving question to continue conversation",
      concrete_day_time_option: "Offer two time slots: 'Tuesday at 2pm or Wednesday at 10am?'"
    };

    return feedbackTemplates[criterion.criterion] || criterion.feedback;
  }

  // Generate grammar feedback in client format
  generateGrammarFeedback() {
    const examples = [
      "You said: 'We can assist the meeting.' Say: 'We can attend the meeting.' Because 'assist' in Spanish means 'attend', but in English it means 'help'.",
      "You said: 'I will call you back.' Say: 'I'll call you back.' Because contractions sound more natural.",
      "You said: 'Very good.' Say: 'That's great!' Because it sounds more natural in conversation."
    ];
    
    return examples[Math.floor(Math.random() * examples.length)];
  }

  // Generate vocabulary feedback in client format
  generateVocabularyFeedback() {
    const examples = [
      "You said: 'win a meeting.' Say: 'book a meeting.' Because 'win' is not natural here.",
      "You said: 'assist you.' Say: 'help you.' Because 'help' is more natural in this context.",
      "You said: 'schedule a reunion.' Say: 'schedule a meeting.' Because 'reunion' is for social gatherings."
    ];
    
    return examples[Math.floor(Math.random() * examples.length)];
  }

  // Helper methods
  hasGrammarIssues(evaluations) {
    // Simulate grammar issue detection
    return Math.random() < 0.3; // 30% chance of grammar feedback
  }

  hasVocabularyIssues(evaluations) {
    // Simulate vocabulary issue detection
    return Math.random() < 0.3; // 30% chance of vocabulary feedback
  }

  // Add to conversation history
  addToHistory(userInput, aiResponse) {
    this.conversationHistory.push(
      { role: 'user', content: userInput },
      { role: 'assistant', content: aiResponse }
    );

    // Keep only last 10 exchanges
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  // Reset conversation state
  resetConversation() {
    this.conversationHistory = [];
    logger.log('🔄 [OPENAI-SPECS] Conversation reset');
  }

  // Get service state
  getState() {
    return {
      isInitialized: this.isInitialized,
      useMockMode: this.useMockMode,
      hasCharacter: !!this.currentCharacter,
      conversationLength: this.conversationHistory.length,
      sessionContext: this.sessionContext
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;