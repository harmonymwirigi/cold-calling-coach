// src/services/openaiService.js - UPDATED WITH ROLEPLAY ENGINE INTEGRATION
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

  // Main method to get AI prospect response based on roleplay specifications
  async getProspectResponse(stage, userInput, context = {}) {
    try {
      logger.log('🤖 AI Processing:', { stage, userInput: userInput?.substring(0, 50), context });
      
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
          logger.warn('OpenAI API failed, using fallback:', error);
          shouldUseFallback = true;
        }
      }

      if (shouldUseFallback || !aiResponse) {
        aiResponse = this.generateFallbackResponse(stage, userInput, context);
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
      
      // Always provide fallback
      const fallbackResponse = this.generateFallbackResponse(stage, userInput, context);
      
      return {
        success: true,
        response: fallbackResponse,
        stage,
        context
      };
    }
  }

  // Generate greeting response based on roleplay type
  generateGreetingResponse() {
    const character = this.currentCharacter || { name: 'Sarah', title: 'VP of Marketing', company: 'TechCorp' };
    
    const greetings = [
      "Hello?",
      `${character.name} speaking.`,
      `Hi, this is ${character.name}.`,
      "Hello, who is this?",
      `${character.name} here.`
    ];

    const response = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      success: true,
      response,
      stage: 'greeting'
    };
  }

  // Generate silence/impatience response
  generateSilenceResponse() {
    const impatienceResponses = [
      "Hello? Are you still with me?",
      "Can you hear me?",
      "Just checking you're there…",
      "Still on the line?",
      "I don't have much time for this.",
      "Sounds like you are gone.",
      "Are you okay to continue?",
      "I am afraid I have to go."
    ];

    const response = impatienceResponses[Math.floor(Math.random() * impatienceResponses.length)];
    
    return {
      success: true,
      response,
      stage: 'silence_warning'
    };
  }

  // Call OpenAI API with roleplay-specific prompts
  async callOpenAIAPI(stage, userInput, context) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const messages = this.buildRoleplayPrompt(stage, userInput, context);
    
    logger.log('📡 Calling OpenAI API for stage:', stage);

    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 120,
      temperature: 0.7,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid OpenAI response structure');
    }

    const aiResponse = response.choices[0].message.content.trim();
    logger.log('✅ OpenAI API response received for stage:', stage);
    
    return aiResponse;
  }

  // Build roleplay-specific prompt based on specifications
  buildRoleplayPrompt(stage, userInput, context) {
    const character = this.currentCharacter || { 
      name: 'Sarah', 
      title: 'VP of Marketing', 
      company: 'TechCorp',
      personality: 'busy, professional, skeptical'
    };

    const basePrompt = this.buildCharacterPrompt(character, context);
    const stagePrompt = this.buildStagePrompt(stage, context);
    
    const systemPrompt = `${basePrompt}\n\n${stagePrompt}\n\nRespond in under 25 words. Use natural, conversational English (CEFR C2 level). Stay in character.`;
    
    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add conversation history (last 6 exchanges)
    const recentHistory = this.conversationHistory.slice(-6);
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

  // Build stage-specific prompt based on roleplay specifications
  buildStagePrompt(stage, context) {
    const stagePrompts = {
      greeting: "You just answered a cold call. Give a simple greeting and wait for their opener.",
      
      opener: "The caller just delivered their opener. Respond with skepticism or curiosity. Keep it brief.",
      
      objection: "Give a realistic early-stage objection from this list: 'What's this about?', 'I'm not interested', 'We don't take cold calls', 'Now is not a good time', 'Is this a sales call?', 'Who gave you this number?'. Pick one that feels natural.",
      
      objection_response: "The caller is handling your objection. If they show empathy and ask good questions, become slightly more receptive. If they argue or pitch immediately, be resistant and consider hanging up.",
      
      mini_pitch: "The caller is giving their pitch. Listen and then either ask a follow-up question about their solution or give a mild objection. Be realistic - not immediately sold but potentially interested.",
      
      pitch_prompt: "You want to hear their pitch. Use one of these: 'Alright, go ahead — what's this about?', 'So… what are you calling me about?', 'You've got 30 seconds. Impress me.', 'I'm listening. What do you do?', 'This better be good. What is it?'",
      
      questions_objections: "After hearing their pitch, either ask a realistic business question or give a post-pitch objection like: 'It's too expensive', 'We already use a competitor', 'How are you different?', 'I'm not the decision-maker'.",
      
      qualification: "The caller is trying to qualify you. If they ask good discovery questions, provide realistic answers about your company's situation. Don't make it too easy - business people are naturally cautious.",
      
      meeting_ask: "The caller is asking for a meeting. Respond realistically - maybe show some interest but also some hesitation. Ask about timing or what the meeting would cover.",
      
      confirmation: "If you've agreed to a meeting, wait for them to confirm details or end the call professionally.",
      
      default: "Continue the conversation naturally as a busy business professional receiving a cold call."
    };

    return stagePrompts[stage] || stagePrompts.default;
  }

  // Generate fallback responses based on stage
  generateFallbackResponse(stage, userInput, context) {
    logger.log('🔄 Using fallback response for stage:', stage);

    const fallbackResponses = {
      greeting: "Hello?",
      
      opener: [
        "What's this about?",
        "I'm not interested.",
        "We don't take cold calls.",
        "Is this a sales call?",
        "Who gave you this number?"
      ],
      
      objection_response: this.generateObjectionResponse(userInput),
      
      mini_pitch: [
        "Tell me more about that.",
        "How exactly does that work?",
        "What makes you different?",
        "That sounds interesting. Go on."
      ],
      
      pitch_prompt: [
        "Alright, go ahead — what's this about?",
        "You've got 30 seconds. Impress me.",
        "I'm listening. What do you do?",
        "Let's hear it."
      ],
      
      questions_objections: [
        "It's too expensive for us.",
        "We already use a competitor.",
        "How are you different from others?",
        "I'm not the decision-maker.",
        "What's the cost involved?",
        "We're pretty busy right now."
      ],
      
      qualification: [
        "We're doing okay with our current setup.",
        "It depends on what you're offering.",
        "Tell me more about how this works.",
        "What exactly are you proposing?"
      ],
      
      meeting_ask: [
        "I'm pretty busy next week.",
        "What would we cover in the meeting?",
        "How long would it take?",
        "Can you send me some information first?"
      ],
      
      default: [
        "I see. Tell me more.",
        "How exactly would that help us?",
        "What's the cost involved?",
        "I'll need to think about that."
      ]
    };

    const responses = fallbackResponses[stage] || fallbackResponses.default;
    
    if (Array.isArray(responses)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    return responses;
  }

  // Generate objection response based on user input quality
  generateObjectionResponse(userInput) {
    const input = userInput.toLowerCase();
    
    // Check for empathy/acknowledgment
    if (input.includes('understand') || input.includes('appreciate') || input.includes('get that') || input.includes('fair')) {
      const positiveResponses = [
        "Okay, what exactly are you offering?",
        "I'm listening. What is it?",
        "Alright, you have two minutes.",
        "Go ahead, but keep it brief."
      ];
      return positiveResponses[Math.floor(Math.random() * positiveResponses.length)];
    }
    
    // Check for arguments or pushiness
    if (input.includes('but ') || input.includes('actually') || input.includes('however')) {
      const resistantResponses = [
        "I really don't have time for this.",
        "Look, I'm not interested.",
        "You're not listening. I said no.",
        "I need to go."
      ];
      return resistantResponses[Math.floor(Math.random() * resistantResponses.length)];
    }
    
    // Default neutral response
    const neutralResponses = [
      "What exactly is this about?",
      "Can you be more specific?",
      "I'm still not clear on what you want.",
      "You have 30 seconds."
    ];
    return neutralResponses[Math.floor(Math.random() * neutralResponses.length)];
  }

  // Generate specific objection types
  getEarlyStageObjection() {
    const earlyObjections = [
      "What's this about?",
      "I'm not interested",
      "We don't take cold calls",
      "Now is not a good time",
      "I have a meeting",
      "Can you call me later?",
      "Send me an email",
      "Who gave you this number?",
      "What are you trying to sell me?",
      "Is this a sales call?",
      "Is this a cold call?",
      "Are you trying to sell me something?",
      "We are ok for the moment",
      "We're not looking for anything right now",
      "How long is this going to take?",
      "What company are you calling from?",
      "I never heard of you"
    ];

    return earlyObjections[Math.floor(Math.random() * earlyObjections.length)];
  }

  getPostPitchObjection() {
    const postPitchObjections = [
      "It's too expensive for us",
      "We have no budget right now",
      "Your competitor is cheaper",
      "Can you give us a discount?",
      "This isn't a good time",
      "We've already set this year's budget",
      "Call me back next quarter",
      "We're busy with other projects",
      "We already use a competitor and we're happy",
      "How exactly are you better than others?",
      "I've never heard of your company",
      "Who else like us have you worked with?",
      "I'm not the decision-maker",
      "I need approval from my team first",
      "How long does this take to implement?",
      "We don't have time to learn a new system"
    ];

    return postPitchObjections[Math.floor(Math.random() * postPitchObjections.length)];
  }

  getPitchPrompt() {
    const pitchPrompts = [
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
    ];

    return pitchPrompts[Math.floor(Math.random() * pitchPrompts.length)];
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

  // Generate coaching feedback (placeholder)
  async generateCoachingFeedback(sessionData) {
    // This would be implemented based on the detailed coaching specifications
    return {
      sales: "Good communication throughout the call.",
      grammar: "Clear and natural English usage.",
      vocabulary: "Appropriate word choices for business context.",
      pronunciation: "Speaking clearly and confidently.",
      overall: "Solid performance! Keep practicing to improve further."
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;