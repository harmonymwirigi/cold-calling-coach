// src/services/openaiService.js - ENHANCED FOR ALL ROLEPLAY MODES INCLUDING MARATHON
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
  }

  async initialize() {
    try {
      if (this.isInitialized) return true;

      logger.log('🤖 Initializing OpenAI service...');

      if (!process.env.REACT_APP_OPENAI_API_KEY) {
        logger.warn('⚠️ OpenAI API key not found - using fallback responses');
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
    
    logger.log('🎭 Session context set:', { roleplayType, mode, character: character?.name });
  }

  // Main method to get AI prospect response - OPTIMIZED FOR ALL MODES
  async getProspectResponse(stage, userInput, context = {}) {
    try {
      logger.log('🤖 AI Processing:', { 
        stage, 
        userInput: userInput?.substring(0, 50), 
        mode: this.sessionContext?.mode,
        roleplayType: this.sessionContext?.roleplayType 
      });
      
      // Handle special stages
      if (stage === 'greeting') {
        return this.generateGreetingResponse();
      }

      if (!userInput || userInput.trim() === '') {
        return this.generateSilenceResponse();
      }

      // Try real AI first, then fallback
      let aiResponse = null;
      let shouldUseFallback = this.useMockMode;

      if (!shouldUseFallback) {
        try {
          aiResponse = await this.callOpenAIAPI(stage, userInput, context);
        } catch (error) {
          logger.warn('🔄 OpenAI API failed, using smart fallback:', error.message);
          shouldUseFallback = true;
        }
      }

      if (shouldUseFallback || !aiResponse) {
        aiResponse = this.generateIntelligentFallback(stage, userInput, context);
      }

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: userInput },
        { role: 'assistant', content: aiResponse }
      );

      return {
        success: true,
        response: aiResponse,
        stage,
        context
      };

    } catch (error) {
      logger.error('❌ OpenAI API error:', error);
      
      // Always provide intelligent fallback
      const fallbackResponse = this.generateIntelligentFallback(stage, userInput, context);
      
      return {
        success: true,
        response: fallbackResponse,
        stage,
        context
      };
    }
  }

  // Generate greeting response based on roleplay type and mode
  generateGreetingResponse() {
    const character = this.currentCharacter || { name: 'Sarah', title: 'VP of Marketing', company: 'TechCorp' };
    const mode = this.sessionContext?.mode || 'practice';
    
    // Different greeting styles based on mode
    let greetings = [];
    
    if (mode === 'marathon' || mode === 'legend') {
      // More varied greetings for marathon/legend mode
      greetings = [
        "Hello?",
        `${character.name} speaking.`,
        `Hi, this is ${character.name}.`,
        "Hello, who is this?",
        `${character.name} here.`,
        "Good morning, how can I help you?",
        `This is ${character.name}, what can I do for you?`,
        "Hello, what's this regarding?",
        `${character.name} from ${character.company}.`,
        "Hi there, who am I speaking with?"
      ];
    } else {
      // Standard greetings for practice mode
      greetings = [
        "Hello?",
        `${character.name} speaking.`,
        `Hi, this is ${character.name}.`,
        "Hello, who is this?",
        `${character.name} here.`
      ];
    }

    const response = greetings[Math.floor(Math.random() * greetings.length)];
    
    logger.log('👋 Generated greeting:', response);
    
    return {
      success: true,
      response,
      stage: 'greeting'
    };
  }

  // Generate silence/impatience response
  generateSilenceResponse() {
    const mode = this.sessionContext?.mode || 'practice';
    
    let impatienceResponses = [];
    
    if (mode === 'marathon' || mode === 'legend') {
      // More varied impatience responses for marathon/legend
      impatienceResponses = [
        "Hello? Are you still with me?",
        "Can you hear me?",
        "Just checking you're there…",
        "Still on the line?",
        "I don't have much time for this.",
        "Sounds like you are gone.",
        "Are you okay to continue?",
        "I am afraid I have to go.",
        "Did I lose you?",
        "Everything alright over there?",
        "I have another call coming in...",
        "Are we still connected?"
      ];
    } else {
      impatienceResponses = [
        "Hello? Are you still with me?",
        "Can you hear me?",
        "Just checking you're there…",
        "Still on the line?",
        "I don't have much time for this."
      ];
    }

    const response = impatienceResponses[Math.floor(Math.random() * impatienceResponses.length)];
    
    return {
      success: true,
      response,
      stage: 'silence_warning'
    };
  }

  // Call OpenAI API with roleplay-specific prompts - ENHANCED FOR ALL MODES
  async callOpenAIAPI(stage, userInput, context) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const messages = this.buildRoleplayPrompt(stage, userInput, context);
    
    logger.log('📡 Calling OpenAI API for:', { 
      stage, 
      mode: this.sessionContext?.mode, 
      roleplayType: this.sessionContext?.roleplayType 
    });

    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150, // Increased for more natural responses
      temperature: 0.8, // Higher for more variety in marathon mode
      presence_penalty: 0.6,
      frequency_penalty: 0.4 // Higher to avoid repetition in marathon
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid OpenAI response structure');
    }

    const aiResponse = response.choices[0].message.content.trim();
    logger.log('✅ OpenAI API response received for stage:', stage);
    
    return aiResponse;
  }

  // Build roleplay-specific prompt based on specifications - ENHANCED FOR ALL MODES
  buildRoleplayPrompt(stage, userInput, context) {
    const character = this.currentCharacter || { 
      name: 'Sarah', 
      title: 'VP of Marketing', 
      company: 'TechCorp',
      personality: 'busy, professional, skeptical'
    };

    const mode = this.sessionContext?.mode || 'practice';
    const roleplayType = this.sessionContext?.roleplayType || 'opener_practice';
    
    const basePrompt = this.buildCharacterPrompt(character, context);
    const stagePrompt = this.buildStagePrompt(stage, context, mode, roleplayType);
    const modePrompt = this.buildModePrompt(mode);
    
    const systemPrompt = `${basePrompt}\n\n${stagePrompt}\n\n${modePrompt}\n\nRespond in under 30 words. Use natural, conversational English. Stay in character. Vary your responses to avoid repetition.`;
    
    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add conversation history (last 8 exchanges for better context)
    const recentHistory = this.conversationHistory.slice(-8);
    messages.push(...recentHistory);

    // Add current user input
    messages.push({
      role: "user",
      content: userInput
    });

    return messages;
  }

  // Build character-specific prompt
  buildCharacterPrompt(character, context) {
    const { roleplayType, userProfile } = this.sessionContext || {};
    
    let characterPrompt = `You are ${character.name}, ${character.title} at ${character.company}.`;
    
    // Add personality traits
    if (character.personality) {
      characterPrompt += ` You are ${character.personality}.`;
    }

    // Add industry context if available
    if (userProfile?.prospect_industry) {
      characterPrompt += ` You work in ${userProfile.prospect_industry}.`;
    }

    // Add custom behavior notes if available
    if (userProfile?.custom_behavior_notes) {
      characterPrompt += ` Additional context: ${userProfile.custom_behavior_notes}`;
    }

    return characterPrompt;
  }

  // Build mode-specific prompt for different difficulty levels
  buildModePrompt(mode) {
    const modePrompts = {
      practice: "Be moderately receptive if they show good sales skills. Give them a fair chance to practice.",
      
      marathon: "Vary your personality across calls. Sometimes be more difficult, sometimes more receptive. Be realistic and challenging but not impossible. Test their adaptability.",
      
      legend: "Be challenging and demanding. You're a tough prospect who expects excellence. Only the best responses should move you forward. Be skeptical and require strong value propositions."
    };

    return modePrompts[mode] || modePrompts.practice;
  }

  // Build stage-specific prompt based on roleplay specifications - ENHANCED
  buildStagePrompt(stage, context, mode, roleplayType) {
    const evaluation = context.evaluation || {};
    const exchanges = context.exchanges || 0;
    
    // Adjust difficulty based on mode
    const difficultyLevel = mode === 'legend' ? 'very challenging' : 
                           mode === 'marathon' ? 'moderately challenging' : 
                           'balanced';

    const stagePrompts = {
      greeting: "You just answered a cold call. Give a brief, professional greeting and wait for their opener.",
      
      opener: `The caller just delivered their opener. Be ${difficultyLevel}. ${
        evaluation.passed 
          ? "They showed good skills - be somewhat receptive but still cautious." 
          : "They didn't impress - be more resistant or give an early objection."
      }`,
      
      objection: `Give a realistic early-stage objection. Choose from: 'What's this about?', 'I'm not interested', 'We don't take cold calls', 'Now is not a good time', 'Is this a sales call?', 'Who gave you this number?', 'We're happy with our current solution'. Be ${difficultyLevel}.`,
      
      objection_response: `The caller is handling your objection. ${
        evaluation.hasEmpathy 
          ? "They showed empathy - become slightly more receptive but still cautious." 
          : "They argued or pushed - be resistant and consider hanging up soon."
      }`,
      
      mini_pitch: `The caller is giving their pitch. ${
        evaluation.passed 
          ? "Listen and ask a follow-up question or show mild interest." 
          : "Give a realistic objection about budget, timing, or need."
      }`,
      
      pitch_prompt: "You want to hear their pitch. Use one of these: 'Alright, go ahead — what's this about?', 'So… what are you calling me about?', 'You've got 30 seconds. Impress me.', 'I'm listening. What do you do?', 'This better be good. What is it?'",
      
      questions_objections: `After hearing their pitch, ${
        evaluation.passed 
          ? "ask a realistic business question about implementation, cost, or results." 
          : "give a post-pitch objection: 'It's too expensive', 'We already use a competitor', 'How are you different?', 'I'm not the decision-maker'."
      }`,
      
      qualification: `The caller is trying to qualify you. ${
        evaluation.passed 
          ? "Provide realistic answers about your company's situation but don't make it too easy." 
          : "Be evasive or redirect back to them."
      }`,
      
      meeting_ask: `The caller is asking for a meeting. ${
        evaluation.passed 
          ? "Show some interest but also some hesitation. Ask about timing or agenda." 
          : "Be reluctant. Ask for more information first or cite being too busy."
      }`,
      
      confirmation: "If you've agreed to a meeting, wait for them to confirm details or end the call professionally.",
      
      close: `They're trying to close. ${
        evaluation.passed 
          ? "Show interest but have some final hesitation about timing or next steps." 
          : "Politely decline or ask for more time to think."
      }`,
      
      default: `Continue the conversation naturally as a ${difficultyLevel} business professional receiving a cold call. You've had ${exchanges} exchanges so far.`
    };

    return stagePrompts[stage] || stagePrompts.default;
  }

  // Generate intelligent fallback when OpenAI fails - ENHANCED FOR ALL MODES
  generateIntelligentFallback(stage, userInput, context) {
    logger.log('🔄 Using intelligent fallback for:', { stage, mode: this.sessionContext?.mode });

    const mode = this.sessionContext?.mode || 'practice';
    const evaluation = context.evaluation || {};
    
    // Mode-specific response pools
    const getResponsePool = (responses) => {
      if (mode === 'marathon' || mode === 'legend') {
        // Larger, more varied pool for marathon/legend
        return [...responses, ...this.getVariedResponses(stage, mode)];
      }
      return responses;
    };

    const fallbackResponses = {
      greeting: ["Hello?", `${this.currentCharacter?.name || 'Sarah'} speaking.`],
      
      opener: getResponsePool(
        evaluation.passed 
          ? ["What's this about?", "I might have a minute. Go on.", "You have my attention."]
          : ["I'm not interested.", "We don't take cold calls.", "Is this a sales call?"]
      ),
      
      objection_response: 
        evaluation.hasEmpathy 
          ? getResponsePool(["Okay, what exactly are you offering?", "I'm listening. What is it?"])
          : getResponsePool(["I really don't have time for this.", "Look, I'm not interested."]),
      
      mini_pitch: getResponsePool([
        "Tell me more about that.",
        "How exactly does that work?", 
        "What makes you different?",
        "That sounds interesting. Go on."
      ]),
      
      pitch_prompt: getResponsePool([
        "Alright, go ahead — what's this about?",
        "You've got 30 seconds. Impress me.",
        "I'm listening. What do you do?",
        "Let's hear it."
      ]),
      
      questions_objections: getResponsePool(
        evaluation.passed 
          ? ["What kind of results do you typically see?", "How long does implementation take?"]
          : ["It's too expensive for us.", "We already use a competitor.", "I'm not the decision-maker."]
      ),
      
      qualification: getResponsePool([
        "We're doing okay with our current setup.",
        "It depends on what you're offering.",
        "Tell me more about how this works.",
        "What exactly are you proposing?"
      ]),
      
      meeting_ask: getResponsePool(
        evaluation.passed 
          ? ["I'm pretty busy next week.", "What would we cover in the meeting?"]
          : ["Can you send me some information first?", "I need to think about that."]
      ),
      
      default: getResponsePool([
        "I see. Tell me more.",
        "How exactly would that help us?",
        "What's the cost involved?",
        "I'll need to think about that."
      ])
    };

    const responses = fallbackResponses[stage] || fallbackResponses.default;
    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    
    logger.log('🎯 Selected fallback response:', selectedResponse);
    
    return selectedResponse;
  }

  // Get varied responses for marathon/legend modes
  getVariedResponses(stage, mode) {
    const variedResponses = {
      opener: [
        "Who gave you this number?",
        "What company are you calling from?",
        "How long is this going to take?",
        "We're not looking for anything right now.",
        "I have a meeting in five minutes.",
        "Can you call me back later?",
        "Send me an email instead."
      ],
      
      objection_response: [
        "You're not listening. I said no.",
        "I need to go.",
        "This isn't a good time.",
        "What part of 'not interested' don't you understand?",
        "You have two minutes to convince me.",
        "Make it quick."
      ],
      
      questions_objections: [
        "We have no budget right now.",
        "Your competitor is cheaper.",
        "Can you give us a discount?",
        "We've already set this year's budget.",
        "Call me back next quarter.",
        "We're busy with other projects.",
        "How exactly are you better than others?",
        "I've never heard of your company.",
        "Who else like us have you worked with?",
        "How long does this take to implement?",
        "We don't have time to learn a new system."
      ]
    };

    return variedResponses[stage] || [];
  }

  // Get specific objection types for warmup challenge
  getWarmupChallengObjection() {
    const objections = [
      "I'm not interested in your product.",
      "We already have a solution for that.",
      "I don't have time for this right now.",
      "Send me some information and I'll look at it.",
      "We're happy with our current vendor.",
      "It's too expensive for us.",
      "We have no budget right now.",
      "Your competitor is cheaper.",
      "This isn't a good time.",
      "We're busy with other projects.",
      "I'm not the decision-maker.",
      "I need approval from my team first.",
      "How are you different from others?",
      "I've never heard of your company.",
      "Who else like us have you worked with?",
      "We don't take cold calls.",
      "Is this a sales call?",
      "What company are you calling from?",
      "Who gave you this number?",
      "How long is this going to take?",
      "We're not looking for anything right now.",
      "Can you call me back later?",
      "Send me an email instead.",
      "We already use a competitor and we're happy.",
      "How long does this take to implement?"
    ];

    return objections[Math.floor(Math.random() * objections.length)];
  }

  // Reset conversation state
  resetConversation() {
    this.conversationHistory = [];
    logger.log('🔄 OpenAI conversation reset');
  }

  // Get conversation state
  getState() {
    return {
      isInitialized: this.isInitialized,
      useMockMode: this.useMockMode,
      hasCharacter: !!this.currentCharacter,
      conversationLength: this.conversationHistory.length,
      sessionContext: this.sessionContext
    };
  }

  // Generate coaching feedback based on evaluation
  async generateCoachingFeedback(sessionData) {
    try {
      if (!this.useMockMode && this.client) {
        // Use OpenAI for detailed coaching feedback
        const coachingPrompt = this.buildCoachingPrompt(sessionData);
        
        const response = await this.client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'system', content: coachingPrompt }],
          max_tokens: 300,
          temperature: 0.7
        });

        if (response.choices?.[0]?.message?.content) {
          return this.parseCoachingResponse(response.choices[0].message.content);
        }
      }
    } catch (error) {
      logger.warn('Failed to generate AI coaching, using fallback');
    }

    // Fallback coaching
    return this.generateFallbackCoaching(sessionData);
  }

  // Build coaching prompt
  buildCoachingPrompt(sessionData) {
    return `You are an expert cold calling coach. Analyze this roleplay session and provide specific feedback:

Session Data: ${JSON.stringify(sessionData, null, 2)}

Provide feedback in these categories:
1. Sales Skills - opener, objection handling, closing
2. Grammar - sentence structure, correctness
3. Vocabulary - word choice, business terminology  
4. Pronunciation - clarity, confidence
5. Overall - key strengths and improvements

Be specific and constructive. Focus on actionable improvements.`;
  }

  // Parse coaching response
  parseCoachingResponse(response) {
    // Basic parsing - could be enhanced with more sophisticated NLP
    return {
      sales: response.match(/Sales[\s\S]*?(?=Grammar|$)/i)?.[0] || "Good sales approach.",
      grammar: response.match(/Grammar[\s\S]*?(?=Vocabulary|$)/i)?.[0] || "Clear communication.",
      vocabulary: response.match(/Vocabulary[\s\S]*?(?=Pronunciation|$)/i)?.[0] || "Appropriate word choices.",
      pronunciation: response.match(/Pronunciation[\s\S]*?(?=Overall|$)/i)?.[0] || "Speaking clearly.",
      overall: response.match(/Overall[\s\S]*$/i)?.[0] || "Keep practicing to improve!"
    };
  }

  // Generate fallback coaching
  generateFallbackCoaching(sessionData) {
    return {
      sales: "Focus on building rapport and understanding prospect needs.",
      grammar: "Use clear, complete sentences and natural contractions.",
      vocabulary: "Choose business-appropriate words that show professionalism.",
      pronunciation: "Speak clearly and confidently with appropriate pace.",
      overall: "Great job practicing! Keep working on active listening and empathy."
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;