// src/services/roleplayEngine.js - NEW COMPREHENSIVE ROLEPLAY ENGINE
import { supabase } from '../config/supabase';
import logger from '../utils/logger';

export class RoleplayEngine {
  constructor() {
    this.currentSession = null;
    this.currentStage = 'greeting';
    this.stageHistory = [];
    this.evaluations = [];
    this.conversationFlow = null;
    this.usedObjections = new Set();
    this.usedQuestions = new Set();
    this.sessionStartTime = null;
    this.callCount = 0;
    this.passCount = 0;
  }

  // CRITICAL: Initialize roleplay session with proper access checking
  async initializeSession(userId, roleplayType, mode, userProfile) {
    try {
      logger.log('🎬 Initializing roleplay session:', { userId, roleplayType, mode });

      // Check user access level
      const accessCheck = await this.checkUserAccess(userId, roleplayType, mode);
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason);
      }

      // Get roleplay configuration
      const config = this.getRoleplayConfig(roleplayType, mode);
      if (!config) {
        throw new Error(`Invalid roleplay configuration: ${roleplayType}/${mode}`);
      }

      // Create session
      this.currentSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        roleplayType,
        mode,
        config,
        userProfile,
        startTime: new Date().toISOString(),
        status: 'active'
      };

      this.sessionStartTime = Date.now();
      this.currentStage = 'greeting';
      this.stageHistory = [];
      this.evaluations = [];
      this.usedObjections.clear();
      this.usedQuestions.clear();
      this.callCount = 0;
      this.passCount = 0;

      // Initialize conversation flow based on roleplay type
      this.conversationFlow = this.createConversationFlow(roleplayType, mode);

      logger.log('✅ Roleplay session initialized successfully');
      return { success: true, session: this.currentSession };

    } catch (error) {
      logger.error('❌ Failed to initialize roleplay session:', error);
      return { success: false, error: error.message };
    }
  }

  // CRITICAL: Check user access based on database and unlock conditions
  async checkUserAccess(userId, roleplayType, mode) {
    try {
      // Get user access level from database
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('access_level')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return { allowed: false, reason: 'User not found' };
      }

      // Get user progress
      const { data: progress, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('roleplay_type', roleplayType);

      const userProgress = progress?.[0] || null;

      // Check access rules based on roleplay type and mode
      return this.evaluateAccess(user.access_level, roleplayType, mode, userProgress);

    } catch (error) {
      logger.error('Error checking user access:', error);
      return { allowed: false, reason: 'Access check failed' };
    }
  }

  // CRITICAL: Evaluate access based on business rules
  evaluateAccess(accessLevel, roleplayType, mode, userProgress) {
    // Access level rules
    if (accessLevel === 'unlimited') {
      return { allowed: true, reason: 'Unlimited access' };
    }

    if (accessLevel === 'limited') {
      // Limited users only get first roleplay
      if (roleplayType === 'opener_practice') {
        return { allowed: true, reason: 'First roleplay always available' };
      }
      return { allowed: false, reason: 'Upgrade required for additional roleplays' };
    }

    if (accessLevel === 'trial') {
      // Trial users get 24-hour unlocks after passing marathons
      if (roleplayType === 'opener_practice') {
        return { allowed: true, reason: 'First roleplay always available' };
      }

      // Check if module is temporarily unlocked
      if (userProgress?.unlock_expiry) {
        const unlockExpiry = new Date(userProgress.unlock_expiry);
        if (unlockExpiry > new Date()) {
          return { allowed: true, reason: 'Temporarily unlocked' };
        }
      }

      return { allowed: false, reason: 'Complete previous marathon to unlock' };
    }

    return { allowed: false, reason: 'Invalid access level' };
  }

  // CRITICAL: Get roleplay configuration based on specifications
  getRoleplayConfig(roleplayType, mode) {
    const configs = {
      opener_practice: {
        practice: {
          type: 'single_call',
          stages: ['greeting', 'opener', 'objection', 'mini_pitch'],
          randomHangupChance: 0.25,
          passingScore: 1,
          totalCalls: 1
        },
        marathon: {
          type: 'marathon',
          stages: ['greeting', 'opener', 'objection', 'mini_pitch'],
          randomHangupChance: 0.25,
          passingScore: 6,
          totalCalls: 10
        },
        legend: {
          type: 'legend',
          stages: ['greeting', 'opener', 'objection', 'mini_pitch'],
          randomHangupChance: 0,
          passingScore: 6,
          totalCalls: 6
        }
      },
      pitch_practice: {
        practice: {
          type: 'single_call',
          stages: ['pitch_prompt', 'mini_pitch', 'questions_objections', 'qualification', 'meeting_ask'],
          randomHangupChance: 0,
          passingScore: 1,
          totalCalls: 1
        },
        marathon: {
          type: 'marathon',
          stages: ['pitch_prompt', 'mini_pitch', 'questions_objections', 'qualification', 'meeting_ask'],
          randomHangupChance: 0,
          passingScore: 6,
          totalCalls: 10
        }
      },
      warmup_challenge: {
        practice: {
          type: 'quickfire',
          totalQuestions: 25,
          passingScore: 18,
          timeLimit: 5000
        }
      },
      full_simulation: {
        practice: {
          type: 'full_call',
          stages: ['greeting', 'opener', 'objection', 'mini_pitch', 'questions_objections', 'qualification', 'meeting_ask', 'confirmation'],
          randomHangupChance: 0.25,
          passingScore: 1,
          totalCalls: 1
        }
      },
      power_hour: {
        practice: {
          type: 'power_hour',
          stages: ['greeting', 'opener', 'objection', 'mini_pitch', 'questions_objections', 'qualification', 'meeting_ask'],
          totalCalls: 20,
          passingScore: 15
        }
      }
    };

    return configs[roleplayType]?.[mode] || null;
  }

  // CRITICAL: Create conversation flow based on roleplay specifications
  createConversationFlow(roleplayType, mode) {
    const flows = {
      opener_practice: this.createOpenerFlow(),
      pitch_practice: this.createPitchFlow(),
      warmup_challenge: this.createWarmupFlow(),
      full_simulation: this.createFullCallFlow(),
      power_hour: this.createPowerHourFlow()
    };

    return flows[roleplayType] || flows.opener_practice;
  }

  createOpenerFlow() {
    return {
      greeting: {
        aiResponse: () => "Hello?",
        nextStage: 'opener',
        evaluationRubric: null
      },
      opener: {
        aiResponse: null, // Wait for user input
        nextStage: 'objection',
        evaluationRubric: 'opener',
        randomHangup: true
      },
      objection: {
        aiResponse: () => this.getRandomObjection('early'),
        nextStage: 'mini_pitch',
        evaluationRubric: 'objection_handling'
      },
      mini_pitch: {
        aiResponse: null, // Wait for user input
        nextStage: 'end',
        evaluationRubric: 'mini_pitch'
      }
    };
  }

  createPitchFlow() {
    return {
      pitch_prompt: {
        aiResponse: () => this.getRandomPitchPrompt(),
        nextStage: 'mini_pitch',
        evaluationRubric: null
      },
      mini_pitch: {
        aiResponse: null,
        nextStage: 'questions_objections',
        evaluationRubric: 'mini_pitch'
      },
      questions_objections: {
        aiResponse: () => this.getRandomQuestionOrObjection(),
        nextStage: 'qualification',
        evaluationRubric: 'objection_handling',
        canRepeat: true
      },
      qualification: {
        aiResponse: null,
        nextStage: 'meeting_ask',
        evaluationRubric: 'qualification'
      },
      meeting_ask: {
        aiResponse: null,
        nextStage: 'end',
        evaluationRubric: 'meeting_ask'
      }
    };
  }

  createWarmupFlow() {
    // This is handled differently - 25 rapid questions
    return {
      quickfire: {
        totalQuestions: 25,
        questionPool: this.getWarmupQuestions(),
        timeLimit: 5000
      }
    };
  }

  createFullCallFlow() {
    return {
      greeting: { aiResponse: () => "Hello?", nextStage: 'opener' },
      opener: { nextStage: 'objection', evaluationRubric: 'opener', randomHangup: true },
      objection: { aiResponse: () => this.getRandomObjection('early'), nextStage: 'mini_pitch', evaluationRubric: 'objection_handling' },
      mini_pitch: { nextStage: 'questions_objections', evaluationRubric: 'mini_pitch' },
      questions_objections: { aiResponse: () => this.getRandomQuestionOrObjection(), nextStage: 'qualification', evaluationRubric: 'objection_handling' },
      qualification: { nextStage: 'meeting_ask', evaluationRubric: 'qualification' },
      meeting_ask: { nextStage: 'confirmation', evaluationRubric: 'meeting_ask' },
      confirmation: { nextStage: 'end', evaluationRubric: null }
    };
  }

  createPowerHourFlow() {
    // Similar to full call but 20 consecutive calls
    return this.createFullCallFlow();
  }

  // CRITICAL: Process user input according to current stage and rubrics
  async processUserInput(userInput, context = {}) {
    if (!this.currentSession || !this.conversationFlow) {
      throw new Error('No active session');
    }

    try {
      const stage = this.conversationFlow[this.currentStage];
      if (!stage) {
        throw new Error(`Invalid stage: ${this.currentStage}`);
      }

      // Handle warmup challenge differently
      if (this.currentSession.roleplayType === 'warmup_challenge') {
        return this.processWarmupInput(userInput);
      }

      // Evaluate user input if rubric exists
      let evaluation = { passed: true, feedback: 'Good response', score: 85 };
      
      if (stage.evaluationRubric) {
        evaluation = this.evaluateInput(userInput, stage.evaluationRubric, context);
        this.evaluations.push({
          stage: this.currentStage,
          input: userInput,
          evaluation,
          timestamp: Date.now()
        });
      }

      // Handle failure
      if (!evaluation.passed) {
        return this.handleStageFail(evaluation);
      }

      // Handle random hangup for opener stage
      if (stage.randomHangup && this.shouldRandomHangup()) {
        return this.handleRandomHangup();
      }

      // Move to next stage
      const nextStage = stage.nextStage;
      const aiResponse = this.getAIResponse(nextStage);

      this.stageHistory.push({
        stage: this.currentStage,
        userInput,
        evaluation,
        timestamp: Date.now()
      });

      this.currentStage = nextStage;

      // Check if call is complete
      if (nextStage === 'end') {
        return this.completeCall(true);
      }

      return {
        success: true,
        response: aiResponse,
        stage: this.currentStage,
        nextStage,
        evaluation,
        shouldHangUp: false
      };

    } catch (error) {
      logger.error('Error processing user input:', error);
      return {
        success: false,
        error: error.message,
        shouldHangUp: true
      };
    }
  }

  // CRITICAL: Evaluate user input based on rubrics from specifications
  evaluateInput(userInput, rubricType, context) {
    const rubrics = {
      opener: this.evaluateOpener,
      objection_handling: this.evaluateObjectionHandling,
      mini_pitch: this.evaluateMiniPitch,
      qualification: this.evaluateQualification,
      meeting_ask: this.evaluateMeetingAsk
    };

    const evaluator = rubrics[rubricType];
    if (!evaluator) {
      return { passed: true, feedback: 'No rubric available', score: 80 };
    }

    return evaluator.call(this, userInput, context);
  }

  // Opener rubric implementation
  evaluateOpener(userInput, context) {
    const input = userInput.toLowerCase();
    let passCount = 0;
    const feedback = [];

    // 1. Clear cold call opener
    if (input.includes('calling') || input.includes('call') || input.includes('this is') || input.includes('hi') || input.includes('hello')) {
      passCount++;
    } else {
      feedback.push('Make your opener clearer');
    }

    // 2. Casual, confident tone (contractions)
    if (input.includes("i'm") || input.includes("you're") || input.includes("we're") || input.includes("don't") || input.includes("can't")) {
      passCount++;
    } else {
      feedback.push('Use more casual tone with contractions');
    }

    // 3. Demonstrates empathy
    const empathyPhrases = ['out of the blue', "don't know me", 'cold call', 'caught you', 'interrupt', 'random', 'unexpected'];
    if (empathyPhrases.some(phrase => input.includes(phrase))) {
      passCount++;
    } else {
      feedback.push('Acknowledge the interruption - show empathy');
    }

    // 4. Ends with soft question
    if (input.includes('?') && (input.includes('tell you') || input.includes('explain') || input.includes('share') || input.includes('why'))) {
      passCount++;
    } else {
      feedback.push('End with a soft question');
    }

    // Pass if 3 of 4
    const passed = passCount >= 3;
    const score = Math.max(50, Math.min(100, (passCount / 4) * 100));

    return {
      passed,
      feedback: feedback.join('. ') || 'Good opener!',
      score,
      criteria: { passed: passCount, total: 4 }
    };
  }

  // Objection handling rubric
  evaluateObjectionHandling(userInput, context) {
    const input = userInput.toLowerCase();
    let passCount = 0;
    const feedback = [];

    // 1. Acknowledges calmly
    const acknowledgments = ['fair enough', 'totally get', 'understand', 'appreciate', 'makes sense'];
    if (acknowledgments.some(phrase => input.includes(phrase))) {
      passCount++;
    } else {
      feedback.push('Acknowledge their concern calmly');
    }

    // 2. Doesn't argue or pitch
    const argumentWords = ['but ', 'however', 'actually', 'wrong', 'should'];
    if (!argumentWords.some(word => input.includes(word))) {
      passCount++;
    } else {
      feedback.push("Don't argue with their objection");
    }

    // 3. Reframes or buys time
    if (input.length > 10 && input.length < 100) { // Reasonable length
      passCount++;
    } else {
      feedback.push('Keep response concise but complete');
    }

    // 4. Ends with forward-moving question
    if (input.includes('?')) {
      passCount++;
    } else {
      feedback.push('Ask a question to keep conversation moving');
    }

    const passed = passCount >= 3;
    const score = Math.max(50, Math.min(100, (passCount / 4) * 100));

    return { passed, feedback: feedback.join('. ') || 'Good objection handling!', score };
  }

  // Mini pitch rubric
  evaluateMiniPitch(userInput, context) {
    const input = userInput.toLowerCase();
    let passCount = 0;
    const feedback = [];

    // 1. Short (1-2 sentences)
    const sentenceCount = (input.match(/[.!?]+/g) || []).length;
    if (sentenceCount <= 2 && input.length < 150) {
      passCount++;
    } else {
      feedback.push('Keep pitch shorter - 1-2 sentences');
    }

    // 2. Problem/outcome focused
    const outcomeWords = ['help', 'solve', 'improve', 'increase', 'reduce', 'save', 'grow'];
    if (outcomeWords.some(word => input.includes(word))) {
      passCount++;
    } else {
      feedback.push('Focus on outcomes, not features');
    }

    // 3. Simple English
    const jargonWords = ['synergy', 'leverage', 'paradigm', 'optimization', 'utilize'];
    if (!jargonWords.some(word => input.includes(word))) {
      passCount++;
    } else {
      feedback.push('Use simpler language');
    }

    // 4. Natural tone
    if (!input.includes('our solution') && !input.includes('our product') && !input.includes('our platform')) {
      passCount++;
    } else {
      feedback.push('Sound more natural, less scripted');
    }

    const passed = passCount >= 3;
    const score = Math.max(50, Math.min(100, (passCount / 4) * 100));

    return { passed, feedback: feedback.join('. ') || 'Great pitch!', score };
  }

  // Qualification rubric
  evaluateQualification(userInput, context) {
    const input = userInput.toLowerCase();
    
    // Check if user attempted to qualify company fit
    const qualifyingQuestions = ['how are you', 'what are you', 'how do you', 'tell me about', 'curious'];
    const hasQualifying = qualifyingQuestions.some(phrase => input.includes(phrase));
    
    if (hasQualifying && input.includes('?')) {
      return { passed: true, feedback: 'Good qualifying question!', score: 85 };
    }
    
    return { passed: false, feedback: 'Need to ask about their current situation', score: 45 };
  }

  // Meeting ask rubric
  evaluateMeetingAsk(userInput, context) {
    const input = userInput.toLowerCase();
    let passCount = 0;
    const feedback = [];

    // 1. Clear meeting ask
    if (input.includes('meet') || input.includes('call') || input.includes('chat') || input.includes('demo')) {
      passCount++;
    } else {
      feedback.push('Ask clearly for a meeting');
    }

    // 2. Offers concrete time
    const timeWords = ['tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'next week', 'this week'];
    if (timeWords.some(word => input.includes(word))) {
      passCount++;
    } else {
      feedback.push('Offer specific day/time options');
    }

    // 3. Confident tone
    if (!input.includes('maybe') && !input.includes('if you want') && !input.includes('possibly')) {
      passCount++;
    } else {
      feedback.push('Be more confident in your ask');
    }

    // 4. Human tone
    if (input.includes("i'd") || input.includes("we'd") || input.includes("let's")) {
      passCount++;
    } else {
      feedback.push('Sound more conversational');
    }

    const passed = passCount >= 3;
    const score = Math.max(50, Math.min(100, (passCount / 4) * 100));

    return { passed, feedback: feedback.join('. ') || 'Good meeting ask!', score };
  }

  // CRITICAL: Complete call and update database
  async completeCall(passed) {
    try {
      this.callCount++;
      if (passed) this.passCount++;

      // Calculate session metrics
      const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      const averageScore = this.evaluations.length > 0 
        ? this.evaluations.reduce((sum, e) => sum + e.evaluation.score, 0) / this.evaluations.length
        : (passed ? 80 : 50);

      const callResult = {
        callNumber: this.callCount,
        passed,
        duration,
        averageScore,
        evaluations: this.evaluations,
        stageHistory: this.stageHistory
      };

      // Check if session is complete
      const isSessionComplete = this.callCount >= this.currentSession.config.totalCalls;
      const sessionPassed = this.passCount >= this.currentSession.config.passingScore;

      if (isSessionComplete) {
        return this.completeSession(sessionPassed, callResult);
      }

      // Continue to next call
      this.resetForNextCall();
      return {
        success: true,
        response: "Call completed. Starting next call...",
        callResult,
        sessionComplete: false,
        nextCall: this.callCount + 1
      };

    } catch (error) {
      logger.error('Error completing call:', error);
      return { success: false, error: error.message };
    }
  }

  // CRITICAL: Complete session and update progress/unlocks
  async completeSession(sessionPassed, finalCallResult) {
    try {
      const totalDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      
      // Calculate final metrics
      const metrics = {
        totalCalls: this.callCount,
        passedCalls: this.passCount,
        passRate: Math.round((this.passCount / this.callCount) * 100),
        averageScore: Math.round(this.evaluations.reduce((sum, e) => sum + e.evaluation.score, 0) / this.evaluations.length || 0),
        duration: totalDuration
      };

      // Log session to database
      const { data: sessionLog, error: logError } = await supabase
        .from('session_logs')
        .insert({
          user_id: this.currentSession.userId,
          session_id: this.currentSession.id,
          roleplay_type: this.currentSession.roleplayType,
          mode: this.currentSession.mode,
          score: metrics.averageScore,
          passed: sessionPassed,
          duration_seconds: totalDuration,
          metrics,
          evaluations: this.evaluations,
          session_data: { stageHistory: this.stageHistory },
          started_at: this.currentSession.startTime,
          ended_at: new Date().toISOString()
        })
        .select()
        .single();

      if (logError) {
        logger.error('Failed to log session:', logError);
      }

      // Update user progress
      await this.updateUserProgress(sessionPassed);

      // Handle unlocks
      const unlocks = await this.handleUnlocks(sessionPassed);

      return {
        success: true,
        sessionComplete: true,
        sessionPassed,
        finalCallResult,
        metrics,
        unlocks,
        response: this.generateCompletionMessage(sessionPassed, metrics)
      };

    } catch (error) {
      logger.error('Error completing session:', error);
      return { success: false, error: error.message };
    }
  }

  // CRITICAL: Update user progress in database
  async updateUserProgress(sessionPassed) {
    try {
      const { roleplayType, mode } = this.currentSession;
      
      // Get existing progress
      const { data: existingProgress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', this.currentSession.userId)
        .eq('roleplay_type', roleplayType)
        .single();

      const updateData = {
        total_attempts: (existingProgress?.total_attempts || 0) + 1,
        total_passes: (existingProgress?.total_passes || 0) + (sessionPassed ? 1 : 0),
        updated_at: new Date().toISOString()
      };

      // Update mode-specific progress
      if (mode === 'marathon' && sessionPassed) {
        updateData.marathon_passes = (existingProgress?.marathon_passes || 0) + 1;
        updateData.legend_attempt_used = false; // Grant legend attempt
      }

      if (mode === 'legend' && sessionPassed) {
        updateData.legend_completed = true;
      }

      // Upsert progress
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: this.currentSession.userId,
          roleplay_type: roleplayType,
          ...updateData
        });

      if (error) {
        logger.error('Failed to update progress:', error);
      }

    } catch (error) {
      logger.error('Error updating user progress:', error);
    }
  }

  // CRITICAL: Handle module unlocks based on business rules
  async handleUnlocks(sessionPassed) {
    if (!sessionPassed) return [];

    const { roleplayType, mode } = this.currentSession;
    const unlocks = [];

    try {
      // Define unlock rules from specifications
      const unlockRules = {
        'opener_practice': {
          marathon: ['pitch_practice'], // Unlocks next module for 24h
        },
        'pitch_practice': {
          marathon: ['warmup_challenge']
        },
        'warmup_challenge': {
          practice: ['full_simulation'] // Pass warmup unlocks full simulation
        },
        'full_simulation': {
          practice: ['power_hour'] // Pass full simulation unlocks power hour
        }
      };

      const rulesToApply = unlockRules[roleplayType]?.[mode];
      if (!rulesToApply) return unlocks;

      // Apply unlock rules
      for (const moduleToUnlock of rulesToApply) {
        const unlockExpiry = new Date();
        unlockExpiry.setHours(unlockExpiry.getHours() + 24); // 24-hour unlock

        const { error } = await supabase
          .from('user_progress')
          .upsert({
            user_id: this.currentSession.userId,
            roleplay_type: moduleToUnlock,
            unlock_expiry: unlockExpiry.toISOString(),
            updated_at: new Date().toISOString()
          });

        if (!error) {
          unlocks.push({
            module: moduleToUnlock,
            expiresAt: unlockExpiry.toISOString()
          });
        }
      }

    } catch (error) {
      logger.error('Error handling unlocks:', error);
    }

    return unlocks;
  }

  // Helper methods for objections and questions
  getRandomObjection(type) {
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
      "Is this a sales call?"
    ];

    const postPitchObjections = [
      "It's too expensive for us",
      "We have no budget right now",
      "Your competitor is cheaper",
      "This isn't a good time",
      "We already use a competitor",
      "How exactly are you better?",
      "I've never heard of your company",
      "I'm not the decision-maker"
    ];

    const objections = type === 'early' ? earlyObjections : postPitchObjections;
    const available = objections.filter(obj => !this.usedObjections.has(obj));
    
    if (available.length === 0) {
      this.usedObjections.clear();
    }
    
    const finalList = available.length > 0 ? available : objections;
    const selected = finalList[Math.floor(Math.random() * finalList.length)];
    this.usedObjections.add(selected);
    
    return selected;
  }

  getRandomPitchPrompt() {
    const prompts = [
      "Alright, go ahead — what's this about?",
      "So… what are you calling me about?",
      "You've got 30 seconds. Impress me.",
      "I'm listening. What do you do?",
      "This better be good. What is it?",
      "Okay. Tell me why you're calling.",
      "Let's hear it."
    ];
    
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  shouldRandomHangup() {
    const chance = this.currentSession.config.randomHangupChance || 0;
    return Math.random() < chance;
  }

  handleRandomHangup() {
    return {
      success: true,
      response: "Sorry, got to run.",
      shouldHangUp: true,
      reason: 'random_hangup',
      callPassed: false
    };
  }

  handleStageFail(evaluation) {
    return {
      success: true,
      response: "I don't have time for this.",
      shouldHangUp: true,
      reason: 'stage_fail',
      evaluation,
      callPassed: false
    };
  }

  getAIResponse(stage) {
    const stageConfig = this.conversationFlow[stage];
    if (stageConfig?.aiResponse) {
      return typeof stageConfig.aiResponse === 'function' 
        ? stageConfig.aiResponse() 
        : stageConfig.aiResponse;
    }
    return "I see. Go on.";
  }

  resetForNextCall() {
    this.currentStage = 'greeting';
    this.stageHistory = [];
    this.evaluations = [];
    // Don't reset used objections - they persist across calls in a session
  }

  generateCompletionMessage(passed, metrics) {
    const { mode } = this.currentSession;
    
    if (mode === 'marathon') {
      if (passed) {
        return `Great job! You passed ${metrics.passedCalls} out of ${metrics.totalCalls} calls. You've unlocked the next modules for 24 hours!`;
      } else {
        return `You completed all ${metrics.totalCalls} calls and scored ${metrics.passedCalls}/${metrics.totalCalls}. Keep practicing!`;
      }
    }
    
    if (mode === 'legend') {
      if (passed) {
        return "Wow—six for six! That's legendary. Very few reps pull this off!";
      } else {
        return "Legend attempt over. To earn another shot, pass Marathon again.";
      }
    }
    
    return passed ? "Excellent work! You passed this practice session." : "Good practice! Try again to improve your score.";
  }
}

// Export singleton instance
export const roleplayEngine = new RoleplayEngine();
export default roleplayEngine;