// src/services/roleplayEngine.js - COMPLETE ENGINE WITH OPENAI INTEGRATION
import { openAIService } from './openaiService';
import { supabase } from '../config/supabase';
import logger from '../utils/logger';

export class RoleplayEngine {
  constructor() {
    this.currentSession = null;
    this.currentCall = null;
    this.callHistory = [];
    this.sessionStartTime = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) return true;

      logger.log('🎭 Initializing RoleplayEngine...');
      
      // Initialize OpenAI service
      await openAIService.initialize();
      
      this.isInitialized = true;
      logger.log('✅ RoleplayEngine initialized with OpenAI integration');
      return true;

    } catch (error) {
      logger.error('❌ RoleplayEngine initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Initialize a new roleplay session
  async initializeSession(userId, roleplayType, mode, userProfile) {
    try {
      logger.log('🎬 Initializing roleplay session:', { userId, roleplayType, mode });

      // Ensure engine is initialized
      await this.initialize();

      // Generate session ID
      const sessionId = `${userId}_${roleplayType}_${mode}_${Date.now()}`;

      // Create character based on user profile
      const character = this.generateCharacter(userProfile);

      // Set up session context
      this.currentSession = {
        id: sessionId,
        userId,
        roleplayType,
        mode,
        userProfile,
        character,
        startTime: new Date().toISOString(),
        totalCalls: 0,
        passedCalls: 0,
        currentCallIndex: 0,
        stage: 'greeting',
        conversationHistory: [],
        callResults: [],
        isActive: true
      };

      // Initialize first call
      this.currentCall = this.initializeCall(1);

      // Set OpenAI context
      openAIService.setSessionContext(roleplayType, mode, userProfile, character);

      this.sessionStartTime = Date.now();
      this.callHistory = [];

      logger.log('✅ Session initialized successfully with OpenAI context');

      return {
        success: true,
        session: this.currentSession
      };

    } catch (error) {
      logger.error('❌ Error initializing session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process user input through OpenAI - THIS IS THE KEY METHOD
  async processUserInput(userInput, context = {}) {
    try {
      if (!this.currentSession || !this.currentSession.isActive) {
        throw new Error('No active session');
      }

      logger.log('🤖 Processing user input through OpenAI:', { 
        input: userInput?.substring(0, 50), 
        stage: context.stage || this.currentCall?.stage,
        mode: this.currentSession.mode
      });

      // Handle greeting stage
      if (context.isGreeting || context.stage === 'greeting') {
        return await this.handleGreeting();
      }

      // Get AI response through OpenAI service - THIS ENSURES ALL MODES USE OPENAI
      const aiResult = await openAIService.getProspectResponse(
        this.currentCall?.stage || 'opener',
        userInput,
        {
          roleplayType: this.currentSession.roleplayType,
          mode: this.currentSession.mode,
          character: this.currentSession.character,
          userProfile: this.currentSession.userProfile,
          conversationHistory: this.currentCall?.conversationHistory || []
        }
      );

      if (!aiResult.success) {
        throw new Error('OpenAI processing failed');
      }

      // Add to conversation history
      this.addToConversationHistory('user', userInput);
      this.addToConversationHistory('ai', aiResult.response);

      // Determine next stage and actions based on roleplay type and mode
      const nextAction = this.determineNextAction(userInput, aiResult, context);

      logger.log('✅ OpenAI processing complete:', {
        response: aiResult.response?.substring(0, 50),
        nextStage: nextAction.nextStage,
        shouldHangUp: nextAction.shouldHangUp
      });

      return {
        success: true,
        response: aiResult.response,
        stage: nextAction.nextStage,
        shouldHangUp: nextAction.shouldHangUp,
        callResult: nextAction.callResult,
        sessionComplete: nextAction.sessionComplete,
        nextCall: nextAction.nextCall,
        reason: nextAction.reason,
        metrics: nextAction.metrics
      };

    } catch (error) {
      logger.error('❌ Error processing user input:', error);
      return {
        success: false,
        error: error.message,
        response: "I'm having trouble understanding. Could you try again?"
      };
    }
  }

  // Handle greeting stage
  async handleGreeting() {
    try {
      logger.log('👋 Handling greeting stage');

      // Get greeting response from OpenAI
      const greetingResult = await openAIService.getProspectResponse('greeting', '', {
        roleplayType: this.currentSession.roleplayType,
        mode: this.currentSession.mode,
        character: this.currentSession.character
      });

      if (greetingResult.success) {
        this.addToConversationHistory('ai', greetingResult.response);
        this.currentCall.stage = 'opener';

        return {
          success: true,
          response: greetingResult.response,
          stage: 'opener'
        };
      }

      throw new Error('Failed to generate greeting');

    } catch (error) {
      logger.error('❌ Error handling greeting:', error);
      
      // Fallback greeting
      const fallbackGreeting = `${this.currentSession.character.name} speaking.`;
      this.addToConversationHistory('ai', fallbackGreeting);
      this.currentCall.stage = 'opener';

      return {
        success: true,
        response: fallbackGreeting,
        stage: 'opener'
      };
    }
  }

  // Determine next action based on roleplay specifications
  determineNextAction(userInput, aiResult, context) {
    const { roleplayType, mode } = this.currentSession;
    const currentStage = this.currentCall.stage;

    logger.log('🎯 Determining next action:', { roleplayType, mode, currentStage });

    // Handle different roleplay types
    switch (roleplayType) {
      case 'opener_practice':
        return this.handleOpenerPractice(userInput, aiResult, currentStage);
      
      case 'pitch_practice':
        return this.handlePitchPractice(userInput, aiResult, currentStage);
      
      case 'warmup_challenge':
        return this.handleWarmupChallenge(userInput, aiResult, currentStage);
      
      case 'full_simulation':
        return this.handleFullSimulation(userInput, aiResult, currentStage);
      
      case 'power_hour':
        return this.handlePowerHour(userInput, aiResult, currentStage);
      
      default:
        return this.handleDefaultFlow(userInput, aiResult, currentStage);
    }
  }

  // Handle Opener + Early Objections flow
  handleOpenerPractice(userInput, aiResult, currentStage) {
    const maxTurns = this.currentSession.mode === 'practice' ? 6 : 8;
    const currentTurn = this.currentCall.conversationHistory.length / 2;

    switch (currentStage) {
      case 'opener':
        // User just gave opener, AI gives objection
        this.currentCall.stage = 'objection_response';
        return {
          nextStage: 'objection_response',
          shouldHangUp: false
        };

      case 'objection_response':
        // User handled objection, AI either asks for pitch or gives another objection
        const empathyScore = this.evaluateEmpathy(userInput);
        
        if (empathyScore >= 3 && currentTurn >= 3) {
          // Good empathy, ask for pitch
          this.currentCall.stage = 'mini_pitch';
          return {
            nextStage: 'mini_pitch',
            shouldHangUp: false
          };
        } else if (currentTurn >= maxTurns) {
          // Too many turns, end call
          return this.endCall('max_turns_reached');
        } else {
          // Give another objection
          return {
            nextStage: 'objection_response',
            shouldHangUp: false
          };
        }

      case 'mini_pitch':
        // User gave pitch, AI asks questions or confirms meeting
        if (currentTurn >= maxTurns || this.shouldEndPositively(userInput)) {
          return this.endCall('meeting_confirmed', true);
        }
        
        this.currentCall.stage = 'qualification';
        return {
          nextStage: 'qualification',
          shouldHangUp: false
        };

      case 'qualification':
        // Final stage - confirm meeting
        return this.endCall('meeting_confirmed', true);

      default:
        return this.endCall('unknown_stage');
    }
  }

  // Handle Pitch + Objections + Close flow
  handlePitchPractice(userInput, aiResult, currentStage) {
    const maxTurns = this.currentSession.mode === 'practice' ? 8 : 10;
    const currentTurn = this.currentCall.conversationHistory.length / 2;

    switch (currentStage) {
      case 'opener':
        // Skip opener, go straight to pitch prompt
        this.currentCall.stage = 'pitch_prompt';
        return {
          nextStage: 'pitch_prompt',
          shouldHangUp: false
        };

      case 'pitch_prompt':
        // User gave pitch, AI gives post-pitch objection
        this.currentCall.stage = 'questions_objections';
        return {
          nextStage: 'questions_objections',
          shouldHangUp: false
        };

      case 'questions_objections':
        // User handled objection, evaluate and either continue or close
        const objectionHandling = this.evaluateObjectionHandling(userInput);
        
        if (objectionHandling >= 3 && currentTurn >= 4) {
          this.currentCall.stage = 'meeting_ask';
          return {
            nextStage: 'meeting_ask',
            shouldHangUp: false
          };
        } else if (currentTurn >= maxTurns) {
          return this.endCall('max_turns_reached');
        }
        
        return {
          nextStage: 'questions_objections',
          shouldHangUp: false
        };

      case 'meeting_ask':
        // User asked for meeting, confirm
        return this.endCall('meeting_confirmed', true);

      default:
        return this.endCall('unknown_stage');
    }
  }

  // Handle Warmup Challenge (rapid-fire Q&A)
  handleWarmupChallenge(userInput, aiResult, currentStage) {
    // This is handled differently - not a conversation flow
    // It should be managed by a separate warmup component
    return {
      nextStage: currentStage,
      shouldHangUp: false,
      sessionComplete: false
    };
  }

  // Handle Full Call Simulation
  handleFullSimulation(userInput, aiResult, currentStage) {
    const maxTurns = this.currentSession.mode === 'practice' ? 12 : 15;
    const currentTurn = this.currentCall.conversationHistory.length / 2;

    // Complete flow: opener → objection → pitch → objection → qualification → close
    switch (currentStage) {
      case 'opener':
        this.currentCall.stage = 'objection';
        return { nextStage: 'objection', shouldHangUp: false };

      case 'objection':
        const empathy = this.evaluateEmpathy(userInput);
        if (empathy >= 3) {
          this.currentCall.stage = 'pitch_prompt';
          return { nextStage: 'pitch_prompt', shouldHangUp: false };
        }
        return { nextStage: 'objection', shouldHangUp: false };

      case 'pitch_prompt':
        this.currentCall.stage = 'questions_objections';
        return { nextStage: 'questions_objections', shouldHangUp: false };

      case 'questions_objections':
        const handling = this.evaluateObjectionHandling(userInput);
        if (handling >= 3 && currentTurn >= 6) {
          this.currentCall.stage = 'qualification';
          return { nextStage: 'qualification', shouldHangUp: false };
        }
        return { nextStage: 'questions_objections', shouldHangUp: false };

      case 'qualification':
        if (currentTurn >= 8 || this.shouldEndPositively(userInput)) {
          this.currentCall.stage = 'meeting_ask';
          return { nextStage: 'meeting_ask', shouldHangUp: false };
        }
        return { nextStage: 'qualification', shouldHangUp: false };

      case 'meeting_ask':
        return this.endCall('meeting_confirmed', true);

      default:
        if (currentTurn >= maxTurns) {
          return this.endCall('max_turns_reached');
        }
        return { nextStage: currentStage, shouldHangUp: false };
    }
  }

  // Handle Power Hour Challenge
  handlePowerHour(userInput, aiResult, currentStage) {
    // Similar to full simulation but more challenging
    return this.handleFullSimulation(userInput, aiResult, currentStage);
  }

  // Default flow handler
  handleDefaultFlow(userInput, aiResult, currentStage) {
    const maxTurns = 10;
    const currentTurn = this.currentCall.conversationHistory.length / 2;

    if (currentTurn >= maxTurns) {
      return this.endCall('max_turns_reached');
    }

    return {
      nextStage: currentStage,
      shouldHangUp: false
    };
  }

  // End current call and evaluate
  endCall(reason, passed = false) {
    logger.log('📞 Ending call:', { reason, passed });

    const callResult = this.evaluateCall(passed, reason);
    
    this.currentSession.totalCalls++;
    this.currentSession.callResults.push(callResult);
    
    if (callResult.passed) {
      this.currentSession.passedCalls++;
    }

    // Check if session should continue (marathon/legend modes)
    const shouldContinue = this.shouldContinueSession();

    if (shouldContinue) {
      // Start next call
      this.currentCall = this.initializeCall(this.currentSession.totalCalls + 1);
      
      return {
        nextStage: 'greeting',
        shouldHangUp: true,
        callResult,
        nextCall: true,
        reason
      };
    } else {
      // End session
      this.currentSession.isActive = false;
      const sessionResult = this.evaluateSession();
      
      return {
        nextStage: 'ended',
        shouldHangUp: true,
        callResult,
        sessionComplete: true,
        sessionPassed: sessionResult.passed,
        metrics: sessionResult,
        reason
      };
    }
  }

  // Initialize a new call within the session
  initializeCall(callNumber) {
    return {
      callNumber,
      startTime: new Date().toISOString(),
      stage: 'greeting',
      conversationHistory: [],
      userInputs: [],
      aiResponses: []
    };
  }

  // Add message to conversation history
  addToConversationHistory(speaker, message) {
    if (!this.currentCall) return;

    const entry = {
      speaker,
      message,
      timestamp: new Date().toISOString(),
      stage: this.currentCall.stage
    };

    this.currentCall.conversationHistory.push(entry);

    if (speaker === 'user') {
      this.currentCall.userInputs.push(message);
    } else {
      this.currentCall.aiResponses.push(message);
    }
  }

  // Evaluate empathy in user response
  evaluateEmpathy(userInput) {
    const input = userInput.toLowerCase();
    let score = 1;

    // Check for empathy indicators
    if (input.includes('understand') || input.includes('appreciate') || 
        input.includes('get that') || input.includes('respect')) {
      score += 2;
    }

    // Check for acknowledgment
    if (input.includes('i hear') || input.includes('makes sense') || 
        input.includes('fair enough')) {
      score += 1;
    }

    // Penalize for arguing
    if (input.includes('but ') || input.includes('however') || 
        input.includes('actually')) {
      score -= 1;
    }

    return Math.max(1, Math.min(4, score));
  }

  // Evaluate objection handling
  evaluateObjectionHandling(userInput) {
    const input = userInput.toLowerCase();
    let score = 1;

    // Check for good techniques
    if (input.includes('help') || input.includes('support') || 
        input.includes('assist')) {
      score += 1;
    }

    if (input.includes('question') || input.includes('curious') || 
        input.includes('interested')) {
      score += 1;
    }

    // Check for benefit-focused language
    if (input.includes('save') || input.includes('improve') || 
        input.includes('increase') || input.includes('reduce')) {
      score += 1;
    }

    return Math.max(1, Math.min(4, score));
  }

  // Check if call should end positively
  shouldEndPositively(userInput) {
    const input = userInput.toLowerCase();
    
    return input.includes('meeting') || input.includes('schedule') || 
           input.includes('calendar') || input.includes('time') ||
           input.includes('available') || input.includes('interested');
  }

  // Check if session should continue to next call
  shouldContinueSession() {
    const { mode, totalCalls, passedCalls } = this.currentSession;

    switch (mode) {
      case 'practice':
        return false; // Practice mode is single call
      
      case 'marathon':
        // Continue until 10 calls or 4 failures
        const failures = totalCalls - passedCalls;
        return totalCalls < 10 && failures < 4;
      
      case 'legend':
        // Continue until 10 calls or any failure
        return totalCalls < 10 && totalCalls === passedCalls;
      
      default:
        return false;
    }
  }

  // Evaluate individual call
  evaluateCall(forcePassed = false, reason = '') {
    const conversation = this.currentCall.conversationHistory;
    const userInputs = this.currentCall.userInputs;
    
    // Calculate scores
    const empathyScore = this.calculateAverageEmpathy(userInputs);
    const objectionScore = this.calculateAverageObjectionHandling(userInputs);
    const flowScore = this.evaluateConversationFlow(conversation);
    const outcomeScore = forcePassed ? 4 : this.evaluateOutcome(reason);

    const averageScore = (empathyScore + objectionScore + flowScore + outcomeScore) / 4;
    const passed = averageScore >= 3.0;

    return {
      callNumber: this.currentCall.callNumber,
      passed,
      scores: {
        empathy: empathyScore,
        objection_handling: objectionScore,
        conversation_flow: flowScore,
        outcome: outcomeScore,
        average: averageScore
      },
      reason,
      duration: Date.now() - new Date(this.currentCall.startTime).getTime(),
      conversationLength: conversation.length
    };
  }

  // Calculate average empathy score
  calculateAverageEmpathy(userInputs) {
    if (userInputs.length === 0) return 1;
    
    const total = userInputs.reduce((sum, input) => {
      return sum + this.evaluateEmpathy(input);
    }, 0);
    
    return total / userInputs.length;
  }

  // Calculate average objection handling score
  calculateAverageObjectionHandling(userInputs) {
    if (userInputs.length === 0) return 1;
    
    const total = userInputs.reduce((sum, input) => {
      return sum + this.evaluateObjectionHandling(input);
    }, 0);
    
    return total / userInputs.length;
  }

  // Evaluate conversation flow
  evaluateConversationFlow(conversation) {
    if (conversation.length < 4) return 2; // Too short
    if (conversation.length > 20) return 2; // Too long
    
    // Good flow is 6-12 exchanges
    if (conversation.length >= 6 && conversation.length <= 12) {
      return 4;
    }
    
    return 3;
  }

  // Evaluate call outcome
  evaluateOutcome(reason) {
    switch (reason) {
      case 'meeting_confirmed':
        return 4;
      case 'positive_end':
        return 3;
      case 'neutral_end':
        return 2;
      case 'negative_end':
      case 'max_turns_reached':
        return 1;
      default:
        return 2;
    }
  }

  // Evaluate entire session
  evaluateSession() {
    const { mode, totalCalls, passedCalls, callResults } = this.currentSession;
    
    const passRate = totalCalls > 0 ? (passedCalls / totalCalls) * 100 : 0;
    const averageScore = this.calculateSessionAverageScore(callResults);
    
    let passed = false;
    
    switch (mode) {
      case 'practice':
        passed = passedCalls > 0;
        break;
      case 'marathon':
        passed = passedCalls >= 6; // 6 out of 10
        break;
      case 'legend':
        passed = totalCalls === 10 && passedCalls === 10; // Perfect score
        break;
    }

    return {
      sessionId: this.currentSession.id,
      roleplayType: this.currentSession.roleplayType,
      mode,
      passed,
      totalCalls,
      passedCalls,
      passRate,
      averageScore,
      duration: Date.now() - this.sessionStartTime,
      callResults
    };
  }

  // Calculate session average score
  calculateSessionAverageScore(callResults) {
    if (callResults.length === 0) return 0;
    
    const total = callResults.reduce((sum, result) => {
      return sum + result.scores.average;
    }, 0);
    
    return total / callResults.length;
  }

  // Generate character based on user profile
  generateCharacter(userProfile) {
    const jobTitle = userProfile?.prospect_job_title || 'Marketing Manager';
    const industry = userProfile?.prospect_industry || 'Technology';
    
    // Character name pool
    const names = ['Sarah', 'Michael', 'Jessica', 'David', 'Amanda', 'James', 'Lisa', 'Robert'];
    const name = names[Math.floor(Math.random() * names.length)];
    
    // Company name based on industry
    const companyNames = {
      'Technology': ['TechCorp', 'InnovateIT', 'DataSolutions', 'CloudFirst'],
      'Healthcare': ['MedSystems', 'HealthTech', 'CareFirst', 'MedInnovate'],
      'Finance': ['FinanceCore', 'BankTech', 'InvestSmart', 'CapitalGroup'],
      'Education': ['EduTech', 'LearningSystems', 'SchoolTech', 'EduInnovate'],
      'Retail': ['RetailCorp', 'ShopSmart', 'Commerce Plus', 'RetailTech']
    };
    
    const companyPool = companyNames[industry] || companyNames.Technology;
    const company = companyPool[Math.floor(Math.random() * companyPool.length)];
    
    // Personality traits
    const personalities = [
      'busy, professional, skeptical',
      'curious, analytical, cautious',
      'friendly but time-conscious',
      'direct, no-nonsense, results-oriented',
      'polite but guarded'
    ];
    
    const personality = personalities[Math.floor(Math.random() * personalities.length)];

    return {
      name,
      title: jobTitle,
      company,
      industry,
      personality,
      customNotes: userProfile?.custom_behavior_notes || ''
    };
  }

  // Complete session and cleanup
  async completeSession(passed, metrics) {
    try {
      if (!this.currentSession) {
        logger.warn('No session to complete');
        return null;
      }

      logger.log('🏁 Completing session:', this.currentSession.id);

      // Calculate final metrics
      const finalMetrics = metrics || this.evaluateSession();

      // Log session to database
      await this.logSessionToDatabase(finalMetrics);

      // Clean up
      const sessionResult = {
        sessionId: this.currentSession.id,
        roleplayType: this.currentSession.roleplayType,
        mode: this.currentSession.mode,
        passed: finalMetrics.passed,
        metrics: finalMetrics
      };

      this.currentSession = null;
      this.currentCall = null;
      this.callHistory = [];

      logger.log('✅ Session completed successfully');
      return sessionResult;

    } catch (error) {
      logger.error('❌ Error completing session:', error);
      return null;
    }
  }

  // Log session to database
  async logSessionToDatabase(metrics) {
    try {
      const { error } = await supabase
        .from('session_logs')
        .insert({
          user_id: this.currentSession.userId,
          session_id: this.currentSession.id,
          roleplay_type: this.currentSession.roleplayType,
          mode: this.currentSession.mode,
          score: metrics.averageScore,
          passed: metrics.passed,
          session_data: {
            ...metrics,
            character: this.currentSession.character,
            userProfile: this.currentSession.userProfile
          },
          duration_seconds: Math.floor(metrics.duration / 1000),
          metrics: metrics,
          evaluations: metrics.callResults || [],
          metadata: {
            version: '2.0',
            openai_integrated: true,
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        logger.error('Failed to log session to database:', error);
      } else {
        logger.log('✅ Session logged to database');
      }
    } catch (error) {
      logger.error('Error logging session:', error);
    }
  }

  // Get current session state
  getSessionState() {
    return {
      hasSession: !!this.currentSession,
      sessionId: this.currentSession?.id,
      isActive: this.currentSession?.isActive,
      currentCall: this.currentCall?.callNumber,
      totalCalls: this.currentSession?.totalCalls,
      passedCalls: this.currentSession?.passedCalls,
      stage: this.currentCall?.stage
    };
  }

  // Reset engine state
  reset() {
    logger.log('🔄 Resetting roleplay engine');
    
    this.currentSession = null;
    this.currentCall = null;
    this.callHistory = [];
    this.sessionStartTime = null;
    
    // Reset OpenAI conversation
    openAIService.resetConversation();
  }
}

// Export singleton instance
export const roleplayEngine = new RoleplayEngine();
export default roleplayEngine;