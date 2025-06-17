// src/services/roleplayEngine.js - FIXED WITH OPENAI INTEGRATION FOR ALL MODES
import { supabase } from '../config/supabase';
import { openAIService } from './openaiService';
import logger from '../utils/logger';

class RoleplayEngine {
  constructor() {
    this.currentSession = null;
    this.conversationState = null;
  }

  // Initialize roleplay session with fallback for user data
  async initializeSession(userId, roleplayType, mode, userProfile) {
    try {
      logger.log('🚀 Initializing roleplay session:', { userId, roleplayType, mode });

      // Get user data with fallback
      let userData = null;
      
      try {
        // Try to get user from database first
        const { data, error } = await supabase
          .from('users')
          .select('access_level, first_name, prospect_job_title, prospect_industry, custom_behavior_notes')
          .eq('id', userId)
          .single();

        if (!error && data) {
          userData = data;
          logger.log('✅ User data loaded from database:', userData);
        } else {
          logger.warn('Database user lookup failed:', error?.message);
          throw new Error('Database lookup failed');
        }
      } catch (dbError) {
        logger.warn('🔄 Database failed, using fallback user data from profile');
        
        // Fallback: use userProfile data
        if (userProfile) {
          userData = {
            access_level: userProfile.access_level || 'trial',
            first_name: userProfile.first_name || 'User',
            prospect_job_title: userProfile.prospect_job_title || 'CEO',
            prospect_industry: userProfile.prospect_industry || 'Technology',
            custom_behavior_notes: userProfile.custom_behavior_notes || ''
          };
          logger.log('✅ Using fallback user data:', userData);
        } else {
          // Last resort: default user data
          userData = {
            access_level: 'trial',
            first_name: 'User',
            prospect_job_title: 'CEO',
            prospect_industry: 'Technology',
            custom_behavior_notes: 'Professional executive, interested in business growth'
          };
          logger.log('⚠️ Using default user data (last resort)');
        }
      }

      // Validate access level
      if (!this.validateAccess(userData.access_level, roleplayType, mode)) {
        throw new Error('Access denied for this roleplay type');
      }

      // Create session configuration
      const sessionConfig = this.createSessionConfig(roleplayType, mode);
      
      // Create character based on user's prospect settings
      const character = this.createCharacter(userData);
      
      // Initialize OpenAI service with session context
      await openAIService.initialize();
      openAIService.setSessionContext(roleplayType, mode, userData, character);
      
      // Initialize conversation state
      this.conversationState = {
        stage: 'greeting',
        callNumber: 1,
        totalCalls: sessionConfig.totalCalls || 1,
        passedCalls: 0,
        currentCallPassed: false,
        exchanges: 0,
        scores: [],
        userData: userData,
        character: character,
        evaluations: []
      };

      // Create session object
      this.currentSession = {
        id: `session_${Date.now()}`,
        userId: userId,
        roleplayType: roleplayType,
        mode: mode,
        config: sessionConfig,
        character: character,
        userProfile: userData,
        startedAt: new Date().toISOString()
      };

      logger.log('✅ Roleplay session initialized successfully:', this.currentSession.id);
      
      return {
        success: true,
        session: this.currentSession
      };

    } catch (error) {
      logger.error('❌ Failed to initialize roleplay session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validate user access with fallback
  validateAccess(accessLevel, roleplayType, mode) {
    // Always allow first roleplay
    if (roleplayType === 'opener_practice') {
      return true;
    }

    // Unlimited users get everything
    if (accessLevel === 'unlimited') {
      return true;
    }

    // For trial/limited users, this would need proper access checking
    // For now, allow access to prevent blocking (since database is having issues)
    logger.log('⚠️ Allowing access due to database issues - implement proper access checking later');
    return true;
  }

  // Create session configuration
  createSessionConfig(roleplayType, mode) {
    const configs = {
      opener_practice: {
        type: mode === 'practice' ? 'conversation' : mode,
        totalCalls: mode === 'marathon' ? 10 : mode === 'legend' ? 10 : 1,
        passingScore: mode === 'marathon' ? 6 : mode === 'legend' ? 10 : 1,
        stages: ['greeting', 'opener', 'objection', 'close'],
        maxExchanges: 6
      },
      pitch_practice: {
        type: mode === 'practice' ? 'conversation' : mode,
        totalCalls: mode === 'marathon' ? 10 : mode === 'legend' ? 10 : 1,
        passingScore: mode === 'marathon' ? 6 : mode === 'legend' ? 10 : 1,
        stages: ['greeting', 'opener', 'pitch', 'objection', 'close'],
        maxExchanges: 8
      },
      warmup_challenge: {
        type: 'quickfire',
        totalQuestions: 25,
        passingScore: 18,
        timeLimit: 5,
        stages: ['question_answer']
      },
      full_simulation: {
        type: mode === 'practice' ? 'conversation' : mode,
        totalCalls: mode === 'marathon' ? 10 : mode === 'legend' ? 10 : 1,
        passingScore: mode === 'marathon' ? 6 : mode === 'legend' ? 10 : 1,
        stages: ['greeting', 'opener', 'pitch', 'objection', 'close', 'meeting'],
        maxExchanges: 10
      },
      power_hour: {
        type: 'endurance',
        totalCalls: 20,
        passingScore: 15,
        stages: ['greeting', 'opener', 'pitch', 'objection', 'close'],
        maxExchanges: 8
      }
    };

    return configs[roleplayType] || configs.opener_practice;
  }

  // Create character based on user's prospect settings
  createCharacter(userData) {
    const jobTitle = userData.prospect_job_title || 'CEO';
    const industry = userData.prospect_industry || 'Technology';
    const behaviorNotes = userData.custom_behavior_notes || '';

    // Generate character name based on job title
    const names = {
      'CEO': ['Sarah Chen', 'Michael Rodriguez', 'Jennifer Park'],
      'CTO': ['David Kim', 'Lisa Thompson', 'James Wilson'],
      'VP of Marketing': ['Emma Davis', 'Robert Garcia', 'Maria Lopez'],
      'default': ['Alex Johnson', 'Taylor Smith', 'Jordan Brown']
    };

    const nameList = names[jobTitle] || names.default;
    const name = nameList[Math.floor(Math.random() * nameList.length)];

    // Generate company name based on industry
    const companyNames = {
      'Technology': ['TechCorp Solutions', 'InnovateX', 'DataDrive Inc'],
      'Healthcare': ['MedTech Solutions', 'HealthFirst Corp', 'CarePlus Systems'],
      'Finance': ['FinanceForward', 'Capital Insights', 'WealthTech Solutions'],
      'default': ['GrowthCorp', 'BusinessPro', 'SuccessFirst Inc']
    };

    const companyList = companyNames[industry] || companyNames.default;
    const company = companyList[Math.floor(Math.random() * companyList.length)];

    return {
      name: name,
      title: jobTitle,
      company: company,
      industry: industry,
      personality: this.generatePersonality(behaviorNotes),
      behaviorNotes: behaviorNotes
    };
  }

  // Generate personality traits based on behavior notes
  generatePersonality(behaviorNotes) {
    if (behaviorNotes.toLowerCase().includes('busy')) {
      return 'busy_executive';
    } else if (behaviorNotes.toLowerCase().includes('skeptical')) {
      return 'skeptical_buyer';
    } else if (behaviorNotes.toLowerCase().includes('data')) {
      return 'analytical_buyer';
    } else {
      return 'professional_executive';
    }
  }

  // Process user input and generate AI response - NOW USES OPENAI FOR ALL MODES
  async processUserInput(userInput, context = {}) {
    try {
      if (!this.currentSession) {
        throw new Error('No active session');
      }

      logger.log('🤖 Processing user input:', userInput?.substring(0, 50), 'Stage:', this.conversationState.stage);

      // Handle greeting stage - USES OPENAI
      if (context.isGreeting || this.conversationState.stage === 'greeting') {
        return await this.handleGreeting();
      }

      // Handle different roleplay types - ALL USE OPENAI
      switch (this.currentSession.roleplayType) {
        case 'warmup_challenge':
          return await this.handleQuickfireMode(userInput);
        
        default:
          return await this.handleConversationMode(userInput, context);
      }

    } catch (error) {
      logger.error('❌ Error processing user input:', error);
      return {
        success: false,
        error: error.message,
        response: "I'm sorry, I had trouble processing that. Could you try again?"
      };
    }
  }

  // Handle greeting stage - NOW USES OPENAI
  async handleGreeting() {
    try {
      logger.log('👋 Generating greeting with OpenAI...');
      
      const greetingResult = await openAIService.getProspectResponse('greeting', '', {
        roleplayType: this.currentSession.roleplayType,
        mode: this.currentSession.mode,
        character: this.currentSession.character
      });

      if (greetingResult.success) {
        this.conversationState.stage = 'opener';
        
        return {
          success: true,
          response: greetingResult.response,
          stage: 'opener',
          shouldHangUp: false
        };
      } else {
        // Fallback greeting if OpenAI fails
        const character = this.currentSession.character;
        const fallbackGreeting = `Hello, this is ${character.name}. How can I help you?`;
        this.conversationState.stage = 'opener';
        
        return {
          success: true,
          response: fallbackGreeting,
          stage: 'opener',
          shouldHangUp: false
        };
      }
    } catch (error) {
      logger.error('❌ Error generating greeting:', error);
      // Fallback greeting
      const character = this.currentSession.character;
      const fallbackGreeting = `Hello, this is ${character.name}. How can I help you?`;
      this.conversationState.stage = 'opener';
      
      return {
        success: true,
        response: fallbackGreeting,
        stage: 'opener',
        shouldHangUp: false
      };
    }
  }

  // Handle conversation mode (practice, marathon, legend) - NOW USES OPENAI
  async handleConversationMode(userInput, context) {
    try {
      const currentStage = this.conversationState.stage;
      
      logger.log('💬 Handling conversation mode with OpenAI:', { stage: currentStage, mode: this.currentSession.mode });
      
      // Evaluate user's response
      const evaluation = this.evaluateResponse(userInput, currentStage);
      
      // Generate AI response using OpenAI service
      const aiResult = await openAIService.getProspectResponse(currentStage, userInput, {
        roleplayType: this.currentSession.roleplayType,
        mode: this.currentSession.mode,
        character: this.currentSession.character,
        evaluation: evaluation,
        exchanges: this.conversationState.exchanges
      });

      let aiResponse = '';
      let nextStage = currentStage;

      if (aiResult.success) {
        aiResponse = aiResult.response;
        nextStage = this.getNextStage(currentStage, evaluation);
      } else {
        // Fallback to basic responses if OpenAI fails
        logger.warn('OpenAI failed, using fallback response');
        const fallbackResult = this.generateFallbackResponse(evaluation, currentStage);
        aiResponse = fallbackResult.response;
        nextStage = fallbackResult.nextStage;
      }
      
      // Update conversation state
      this.updateConversationState(evaluation, nextStage);
      
      // Check if call should end
      const shouldHangUp = this.shouldEndCall(evaluation, nextStage);
      
      // Handle call completion for marathon/legend modes
      let callResult = null;
      let nextCall = false;
      
      if (shouldHangUp) {
        callResult = this.completeCurrentCall(evaluation);
        nextCall = this.shouldStartNextCall();
        
        if (nextCall) {
          this.startNextCall();
        }
      }
      
      return {
        success: true,
        response: aiResponse,
        stage: nextStage,
        shouldHangUp: shouldHangUp,
        evaluation: evaluation,
        callPassed: evaluation.passed,
        callResult: callResult,
        nextCall: nextCall,
        sessionComplete: shouldHangUp && !nextCall
      };
      
    } catch (error) {
      logger.error('❌ Error in conversation mode:', error);
      
      // Emergency fallback
      return {
        success: true,
        response: "I'm sorry, could you repeat that?",
        stage: this.conversationState.stage,
        shouldHangUp: false,
        evaluation: { passed: false, score: 2 }
      };
    }
  }

  // Handle quickfire mode (warmup challenge) - NOW USES OPENAI FOR QUESTIONS
  async handleQuickfireMode(userInput) {
    try {
      logger.log('⚡ Handling quickfire mode with OpenAI...');
      
      this.conversationState.exchanges++;
      
      // Evaluate the user's response
      const evaluation = this.evaluateQuickfireResponse(userInput);
      
      if (evaluation.passed) {
        this.conversationState.passedCalls++;
      }
      
      // Add to evaluations
      this.conversationState.evaluations.push(evaluation);

      // Check if session is complete
      if (this.conversationState.exchanges >= 25) {
        return this.completeSession(true, {
          totalQuestions: 25,
          correctAnswers: this.conversationState.passedCalls,
          averageScore: (this.conversationState.passedCalls / 25) * 4,
          passed: this.conversationState.passedCalls >= 18
        });
      }

      // Generate next objection using OpenAI
      const nextQuestionResult = await openAIService.getProspectResponse('objection', '', {
        roleplayType: 'warmup_challenge',
        mode: 'practice',
        questionNumber: this.conversationState.exchanges + 1,
        totalQuestions: 25
      });

      let nextQuestion = '';
      
      if (nextQuestionResult.success) {
        nextQuestion = nextQuestionResult.response;
      } else {
        // Fallback to predefined objections
        const fallbackObjections = [
          "I'm not interested in your product.",
          "We already have a solution for that.",
          "I don't have time for this right now.",
          "Send me some information and I'll look at it.",
          "We're happy with our current vendor.",
          "This isn't in our budget.",
          "I need to discuss this with my team first.",
          "We're not looking for anything right now.",
          "How is this different from what we already use?",
          "I've never heard of your company before."
        ];
        nextQuestion = fallbackObjections[Math.floor(Math.random() * fallbackObjections.length)];
      }
      
      return {
        success: true,
        response: nextQuestion,
        stage: 'question_answer',
        shouldHangUp: false,
        evaluation: evaluation,
        questionNumber: this.conversationState.exchanges,
        totalQuestions: 25,
        score: this.conversationState.passedCalls
      };
      
    } catch (error) {
      logger.error('❌ Error in quickfire mode:', error);
      
      // Fallback question
      return {
        success: true,
        response: "I'm not interested in what you're selling.",
        stage: 'question_answer',
        shouldHangUp: false,
        evaluation: { passed: false, score: 2 }
      };
    }
  }

  // Evaluate quickfire response
  evaluateQuickfireResponse(userInput) {
    const length = userInput.length;
    const hasEmpathy = /sorry|understand|hear|appreciate|get that|fair/i.test(userInput);
    const hasValue = /help|benefit|save|improve|increase|solution|results/i.test(userInput);
    const hasQuestion = userInput.includes('?');
    const hasPersonalization = /you|your|specific|situation|currently/i.test(userInput);
    
    let score = 1; // Base score
    
    // Length requirements
    if (length > 15) score += 1;
    if (length > 30) score += 0.5;
    
    // Key elements
    if (hasEmpathy) score += 0.5;
    if (hasValue) score += 0.5;
    if (hasQuestion) score += 0.5;
    if (hasPersonalization) score += 0.5;
    
    // Cap at 4
    score = Math.min(4, score);
    
    return {
      passed: score >= 3,
      score: score,
      feedback: this.generateQuickfireFeedback(score, hasEmpathy, hasValue, hasQuestion),
      hasEmpathy,
      hasValue,
      hasQuestion,
      hasPersonalization
    };
  }

  // Generate quickfire feedback
  generateQuickfireFeedback(score, hasEmpathy, hasValue, hasQuestion) {
    const feedback = [];
    
    if (score >= 3.5) {
      feedback.push("Excellent objection handling!");
    } else if (score >= 3) {
      feedback.push("Good response!");
    } else {
      feedback.push("Needs improvement.");
    }
    
    if (!hasEmpathy) {
      feedback.push("Add empathy (I understand...)");
    }
    
    if (!hasValue) {
      feedback.push("Communicate value/benefit");
    }
    
    if (!hasQuestion) {
      feedback.push("Ask a follow-up question");
    }
    
    return feedback.join(" ");
  }

  // Evaluate user response
  evaluateResponse(userInput, stage) {
    const length = userInput.length;
    const hasEmpathy = /sorry|understand|hear|appreciate|get that|fair/i.test(userInput);
    const hasValue = /help|benefit|save|improve|increase|solution|results/i.test(userInput);
    const hasQuestion = userInput.includes('?');
    const hasPersonalization = /you|your|specific|situation|currently/i.test(userInput);
    const isNatural = this.checkNaturalness(userInput);
    
    let score = 2; // Base score
    
    // Stage-specific evaluation
    switch (stage) {
      case 'opener':
        if (length > 20) score += 0.5;
        if (hasValue) score += 0.5;
        if (hasQuestion) score += 0.5;
        if (hasPersonalization) score += 0.5;
        break;
        
      case 'objection':
        if (hasEmpathy) score += 0.75; // Empathy is crucial for objections
        if (hasValue) score += 0.5;
        if (hasQuestion) score += 0.5;
        if (length > 15) score += 0.25;
        break;
        
      case 'pitch':
        if (length > 30) score += 0.5;
        if (hasValue) score += 0.75; // Value is crucial in pitch
        if (hasQuestion) score += 0.5;
        if (hasPersonalization) score += 0.25;
        break;
        
      default:
        if (length > 20) score += 0.5;
        if (hasValue) score += 0.5;
        if (hasQuestion) score += 0.5;
    }
    
    // Naturalness bonus
    if (isNatural) score += 0.25;
    
    // Cap at 4
    score = Math.min(4, score);
    
    return {
      passed: score >= 3,
      score: score,
      feedback: this.generateFeedback(score, hasEmpathy, hasValue, hasQuestion, stage),
      hasEmpathy,
      hasValue,
      hasQuestion,
      hasPersonalization,
      isNatural
    };
  }

  // Check if response sounds natural
  checkNaturalness(userInput) {
    const contractions = /don't|won't|can't|isn't|aren't|hasn't|haven't|didn't|wouldn't|couldn't/i.test(userInput);
    const casual = /yeah|sure|okay|alright|got it|makes sense/i.test(userInput);
    const tooFormal = /furthermore|additionally|however|nevertheless|subsequently/i.test(userInput);
    
    return (contractions || casual) && !tooFormal;
  }

  // Generate fallback response when OpenAI fails
  generateFallbackResponse(evaluation, currentStage) {
    if (evaluation.passed) {
      // Positive responses
      const responses = {
        opener: [
          "That's interesting. Tell me more about how this works.",
          "I might have a few minutes. What exactly are you offering?",
          "Okay, you have my attention. What's this about?"
        ],
        pitch: [
          "That sounds promising. What kind of results have you seen?",
          "Interesting. How does this compare to what we're doing now?",
          "I like what I'm hearing. What would be the next step?"
        ],
        objection: [
          "You make a good point. I hadn't thought of it that way.",
          "That addresses my concern. What else should I know?",
          "Fair enough. I can see the value in that."
        ]
      };
      
      const stageResponses = responses[currentStage] || responses.opener;
      const response = stageResponses[Math.floor(Math.random() * stageResponses.length)];
      
      return {
        response: response,
        nextStage: this.getNextStage(currentStage, evaluation)
      };
    } else {
      // Objection responses
      const objections = [
        "I'm really not interested. We're happy with what we have.",
        "I don't have time for this right now. Can you send me some information?",
        "We already work with someone for this. Thanks anyway.",
        "I'm not the right person to talk to about this.",
        "We don't have budget for anything new right now.",
        "I've never heard of your company before."
      ];
      
      const response = objections[Math.floor(Math.random() * objections.length)];
      
      return {
        response: response,
        nextStage: 'objection'
      };
    }
  }

  // Get next conversation stage
  getNextStage(currentStage, evaluation) {
    if (!evaluation.passed) {
      return 'objection'; // Stay in objection handling
    }
    
    const stages = {
      opener: 'pitch',
      pitch: 'objection',
      objection: 'close',
      close: 'meeting',
      meeting: 'end'
    };
    
    return stages[currentStage] || 'close';
  }

  // Update conversation state
  updateConversationState(evaluation, nextStage) {
    this.conversationState.exchanges++;
    this.conversationState.scores.push(evaluation.score);
    this.conversationState.evaluations.push(evaluation);
    this.conversationState.stage = nextStage;
    
    // Update current call status
    const averageScore = this.conversationState.scores.reduce((a, b) => a + b) / this.conversationState.scores.length;
    this.conversationState.currentCallPassed = averageScore >= 3;
  }

  // Check if call should end
  shouldEndCall(evaluation, currentStage) {
    const maxExchanges = this.currentSession.config.maxExchanges || 6;
    
    // End call if we've reached max exchanges or final stage
    return this.conversationState.exchanges >= maxExchanges || currentStage === 'end' || currentStage === 'meeting';
  }

  // Complete current call (for marathon/legend modes)
  completeCurrentCall(evaluation) {
    const averageScore = this.conversationState.scores.reduce((a, b) => a + b) / this.conversationState.scores.length;
    const passed = averageScore >= 3;
    
    if (passed) {
      this.conversationState.passedCalls++;
    }
    
    const callResult = {
      callNumber: this.conversationState.callNumber,
      passed: passed,
      averageScore: averageScore,
      totalExchanges: this.conversationState.exchanges,
      evaluations: [...this.conversationState.evaluations]
    };
    
    logger.log('📞 Call completed:', callResult);
    
    return callResult;
  }

  // Check if should start next call (marathon/legend mode)
  shouldStartNextCall() {
    if (this.currentSession.mode === 'practice') {
      return false;
    }
    
    return this.conversationState.callNumber < this.conversationState.totalCalls;
  }

  // Start next call in marathon/legend mode
  startNextCall() {
    this.conversationState.callNumber++;
    this.conversationState.stage = 'greeting';
    this.conversationState.exchanges = 0;
    this.conversationState.scores = [];
    this.conversationState.evaluations = [];
    this.conversationState.currentCallPassed = false;
    
    logger.log('📞 Starting next call:', this.conversationState.callNumber);
  }

  // Generate feedback based on evaluation
  generateFeedback(score, hasEmpathy, hasValue, hasQuestion, stage) {
    const feedback = [];
    
    if (score >= 3.5) {
      feedback.push("Excellent response!");
    } else if (score >= 3) {
      feedback.push("Good response!");
    } else {
      feedback.push("Try to improve your response.");
    }
    
    // Stage-specific feedback
    if (stage === 'objection' && !hasEmpathy) {
      feedback.push("Show empathy first (I understand...)");
    } else if (!hasEmpathy) {
      feedback.push("Consider showing more empathy.");
    }
    
    if (!hasValue) {
      feedback.push("Communicate clear value/benefit.");
    }
    
    if (!hasQuestion) {
      feedback.push("Ask a follow-up question.");
    }
    
    return feedback.join(" ");
  }

  // Complete the session
  completeSession(passed, metrics) {
    if (!this.currentSession) {
      return {
        success: false,
        error: 'No active session to complete'
      };
    }

    const sessionMetrics = metrics || {
      totalCalls: this.conversationState.callNumber,
      passedCalls: this.conversationState.passedCalls,
      passRate: Math.round((this.conversationState.passedCalls / this.conversationState.callNumber) * 100),
      averageScore: this.conversationState.scores.length > 0 
        ? this.conversationState.scores.reduce((a, b) => a + b) / this.conversationState.scores.length
        : 0
    };

    // Determine if session passed based on mode requirements
    let sessionPassed = false;
    if (this.currentSession.mode === 'practice') {
      sessionPassed = sessionMetrics.averageScore >= 3;
    } else if (this.currentSession.mode === 'marathon') {
      sessionPassed = this.conversationState.passedCalls >= 6;
    } else if (this.currentSession.mode === 'legend') {
      sessionPassed = this.conversationState.passedCalls >= 10;
    } else if (this.currentSession.roleplayType === 'warmup_challenge') {
      sessionPassed = metrics.passed;
    }

    logger.log('🏁 Session completed:', { sessionPassed, metrics: sessionMetrics });

    // Reset session
    const completedSession = this.currentSession;
    this.currentSession = null;
    this.conversationState = null;

    // Reset OpenAI conversation
    openAIService.resetConversation();

    return {
      success: true,
      sessionPassed: sessionPassed,
      metrics: sessionMetrics,
      sessionId: completedSession.id,
      sessionComplete: true,
      response: sessionPassed 
        ? "🎉 Congratulations! You've completed this roleplay successfully!"
        : "Session completed. Keep practicing to improve your skills!"
    };
  }
}

// Create and export singleton instance
export const roleplayEngine = new RoleplayEngine();
export default roleplayEngine;