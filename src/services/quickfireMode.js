// src/services/quickfireMode.js - WARMUP CHALLENGE IMPLEMENTATION
import { openAIService } from './openaiService';
import logger from '../utils/logger';

export class QuickfireMode {
  constructor() {
    this.masterPromptList = this.initializeMasterPrompts();
    this.rubrics = this.initializeRubrics();
  }

  // Initialize the 54 master prompts as per client specs
  initializeMasterPrompts() {
    return [
      { id: 1, prompt: "Give your opener.", rubric: "opener" },
      { id: 2, prompt: "What's your pitch in one sentence?", rubric: "miniPitch" },
      { id: 3, prompt: "Ask me for a meeting.", rubric: "meetingAsk", pushback: "I'm busy next week." },
      { id: 4, prompt: "What's this about?", rubric: "earlyObjection" },
      { id: 5, prompt: "I'm not interested.", rubric: "earlyObjection" },
      { id: 6, prompt: "We don't take cold calls.", rubric: "earlyObjection" },
      { id: 7, prompt: "Now is not a good time.", rubric: "earlyObjection" },
      { id: 8, prompt: "I have a meeting.", rubric: "earlyObjection" },
      { id: 9, prompt: "Can you call me later?", rubric: "earlyObjection" },
      { id: 10, prompt: "I'm about to go into a meeting.", rubric: "earlyObjection" },
      { id: 11, prompt: "Send me an email.", rubric: "earlyObjection" },
      { id: 12, prompt: "Can you send me the information?", rubric: "earlyObjection" },
      { id: 13, prompt: "Can you message me on WhatsApp?", rubric: "earlyObjection" },
      { id: 14, prompt: "Who gave you this number?", rubric: "earlyObjection" },
      { id: 15, prompt: "This is my personal number.", rubric: "earlyObjection" },
      { id: 16, prompt: "Where did you get my number?", rubric: "earlyObjection" },
      { id: 17, prompt: "What are you trying to sell me?", rubric: "earlyObjection" },
      { id: 18, prompt: "Is this a sales call?", rubric: "earlyObjection" },
      { id: 19, prompt: "Is this a cold call?", rubric: "earlyObjection" },
      { id: 20, prompt: "Are you trying to sell me something?", rubric: "earlyObjection" },
      { id: 21, prompt: "We are OK for the moment.", rubric: "earlyObjection" },
      { id: 22, prompt: "We are all good / all set.", rubric: "earlyObjection" },
      { id: 23, prompt: "We're not looking for anything right now.", rubric: "earlyObjection" },
      { id: 24, prompt: "We are not changing anything.", rubric: "earlyObjection" },
      { id: 25, prompt: "How long is this going to take?", rubric: "earlyObjection" },
      { id: 26, prompt: "Is this going to take long?", rubric: "earlyObjection" },
      { id: 27, prompt: "What company are you calling from?", rubric: "earlyObjection" },
      { id: 28, prompt: "Who are you again?", rubric: "earlyObjection" },
      { id: 29, prompt: "Where are you calling from?", rubric: "earlyObjection" },
      { id: 30, prompt: "I've never heard of you.", rubric: "earlyObjection" },
      { id: 31, prompt: "It's too expensive for us.", rubric: "postPitchObjection" },
      { id: 32, prompt: "We have no budget right now.", rubric: "postPitchObjection" },
      { id: 33, prompt: "Your competitor is cheaper.", rubric: "postPitchObjection" },
      { id: 34, prompt: "Can you give us a discount?", rubric: "postPitchObjection" },
      { id: 35, prompt: "This isn't a good time.", rubric: "postPitchObjection" },
      { id: 36, prompt: "We've already set this year's budget.", rubric: "postPitchObjection" },
      { id: 37, prompt: "Call me back next quarter.", rubric: "postPitchObjection" },
      { id: 38, prompt: "We're busy with other projects right now.", rubric: "postPitchObjection" },
      { id: 39, prompt: "We already use a competitor and we're happy.", rubric: "postPitchObjection" },
      { id: 40, prompt: "We built something similar ourselves.", rubric: "postPitchObjection" },
      { id: 41, prompt: "How exactly are you better than the competitor?", rubric: "postPitchObjection" },
      { id: 42, prompt: "Switching providers seems like a lot of work.", rubric: "postPitchObjection" },
      { id: 43, prompt: "I've never heard of your company.", rubric: "postPitchObjection" },
      { id: 44, prompt: "Who else like us have you worked with?", rubric: "postPitchObjection" },
      { id: 45, prompt: "Can you send customer testimonials?", rubric: "postPitchObjection" },
      { id: 46, prompt: "How do I know this will really work?", rubric: "postPitchObjection" },
      { id: 47, prompt: "I'm not the decision-maker.", rubric: "postPitchObjection" },
      { id: 48, prompt: "I need approval from my team first.", rubric: "postPitchObjection" },
      { id: 49, prompt: "Can you send details so I can forward them?", rubric: "postPitchObjection" },
      { id: 50, prompt: "We'll need buy-in from other departments.", rubric: "postPitchObjection" },
      { id: 51, prompt: "How long does this take to implement?", rubric: "postPitchObjection" },
      { id: 52, prompt: "We don't have time to learn a new system.", rubric: "postPitchObjection" },
      { id: 53, prompt: "I'm concerned this won't integrate with our tools.", rubric: "postPitchObjection" },
      { id: 54, prompt: "What happens if this doesn't work as promised?", rubric: "postPitchObjection" }
    ];
  }

  // Initialize rubrics for evaluation
  initializeRubrics() {
    return {
      opener: {
        criteria: [
          "Clear cold call opener (pattern interrupt, permission-based, or value-first)",
          "Casual, confident tone (uses contractions and short phrases)",
          "Demonstrates empathy: acknowledges interruption/unfamiliarity",
          "Ends with a soft question"
        ],
        passRequirement: 3
      },
      miniPitch: {
        criteria: [
          "Short (1–2 sentences)",
          "Outcome/problem-focused",
          "Simple English, no jargon",
          "Natural tone"
        ],
        passRequirement: 3
      },
      meetingAsk: {
        criteria: [
          "Clear meeting ask",
          "Offers ≥ 1 concrete day/time slot",
          "Re-asks after push-back",
          "Confident, human tone"
        ],
        passRequirement: 4
      },
      earlyObjection: {
        criteria: [
          "Acknowledges calmly ('Fair enough', 'Totally get that')",
          "Doesn't argue or pitch",
          "Reframes or buys time in one sentence",
          "Ends with a forward-moving question"
        ],
        passRequirement: 3
      },
      postPitchObjection: {
        criteria: [
          "Acknowledges calmly",
          "Doesn't argue or pitch",
          "Reframes or buys time in one sentence", 
          "Ends with a forward-moving question"
        ],
        passRequirement: 3
      }
    };
  }

  // Start quickfire session
  async startQuickfireSession(userId, userProfile) {
    try {
      logger.log('⚡ Starting quickfire session for user:', userId);

      // Shuffle and select 25 prompts
      const shuffledPrompts = this.shuffleArray([...this.masterPromptList]);
      const selectedPrompts = shuffledPrompts.slice(0, 25);

      const session = {
        id: `quickfire_${Date.now()}`,
        userId,
        userProfile,
        prompts: selectedPrompts,
        currentPromptIndex: 0,
        responses: [],
        score: 0,
        correctAnswers: 0,
        startedAt: new Date().toISOString(),
        phase: 'quickfire',
        awaitingSkipConfirm: false,
        silenceWarnings: 0
      };

      return {
        success: true,
        session,
        firstPrompt: this.serveNextPrompt(session)
      };

    } catch (error) {
      logger.error('❌ Error starting quickfire session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process user response in quickfire mode
  async processQuickfireResponse(session, userInput) {
    try {
      logger.log('⚡ Processing quickfire response:', userInput?.substring(0, 50));

      // Handle skip requests
      if (this.isSkipRequest(userInput)) {
        return this.handleSkipRequest(session, userInput);
      }

      // Handle silence
      if (!userInput || userInput.trim() === '') {
        return this.handleQuickfireSilence(session);
      }

      // Get current prompt
      const currentPrompt = session.prompts[session.currentPromptIndex];
      if (!currentPrompt) {
        return this.completeQuickfireSession(session);
      }

      // Evaluate response
      const evaluation = this.evaluateQuickfireResponse(userInput, currentPrompt.rubric);
      
      // Record response
      session.responses.push({
        promptId: currentPrompt.id,
        prompt: currentPrompt.prompt,
        userResponse: userInput,
        evaluation,
        timestamp: Date.now()
      });

      if (evaluation.passed) {
        session.correctAnswers++;
      }

      session.currentPromptIndex++;

      // Check if session complete
      if (session.currentPromptIndex >= 25) {
        return this.completeQuickfireSession(session);
      }

      // Serve next prompt
      return this.serveNextPrompt(session);

    } catch (error) {
      logger.error('❌ Error processing quickfire response:', error);
      return {
        success: false,
        error: error.message,
        aiResponse: "Sorry, something went wrong. Let's continue.",
        coachTag: "PROMPT"
      };
    }
  }

  // Serve next prompt
  serveNextPrompt(session) {
    const currentPrompt = session.prompts[session.currentPromptIndex];
    
    if (!currentPrompt) {
      return this.completeQuickfireSession(session);
    }

    logger.log('⚡ Serving prompt:', currentPrompt.prompt);

    return {
      success: true,
      aiResponse: currentPrompt.prompt,
      coachTag: "PROMPT",
      state: {
        phase: "quickfire",
        promptCount: session.currentPromptIndex + 1,
        awaitingSkipConfirm: false,
        remainingPrompts: session.prompts.slice(session.currentPromptIndex + 1).map(p => p.id)
      },
      currentPrompt
    };
  }

  // Handle skip requests
  handleSkipRequest(session, userInput) {
    const input = userInput.toLowerCase().trim();

    if (session.awaitingSkipConfirm) {
      if (input.includes('yes skip')) {
        // Skip confirmed
        const currentPrompt = session.prompts[session.currentPromptIndex];
        
        session.responses.push({
          promptId: currentPrompt.id,
          prompt: currentPrompt.prompt,
          userResponse: '[SKIPPED]',
          evaluation: { passed: false, score: 0, feedback: 'Skipped' },
          timestamp: Date.now()
        });

        session.currentPromptIndex++;
        session.awaitingSkipConfirm = false;

        if (session.currentPromptIndex >= 25) {
          return this.completeQuickfireSession(session);
        }

        return this.serveNextPrompt(session);
      } else if (input.includes('no')) {
        // Skip cancelled
        session.awaitingSkipConfirm = false;
        return this.serveNextPrompt(session);
      }
    }

    if (input.includes('pass') || input.includes('skip')) {
      session.awaitingSkipConfirm = true;
      return {
        success: true,
        aiResponse: "Are you sure you want to skip? Say 'yes skip' or 'no'.",
        coachTag: "CONFIRM",
        state: {
          phase: "quickfire",
          promptCount: session.currentPromptIndex,
          awaitingSkipConfirm: true,
          remainingPrompts: session.prompts.slice(session.currentPromptIndex).map(p => p.id)
        }
      };
    }

    return null; // Not a skip request
  }

  // Handle silence in quickfire mode
  handleQuickfireSilence(session) {
    session.silenceWarnings++;

    if (session.silenceWarnings >= 2) {
      // Mark as failed and move to next
      const currentPrompt = session.prompts[session.currentPromptIndex];
      
      session.responses.push({
        promptId: currentPrompt.id,
        prompt: currentPrompt.prompt,
        userResponse: '[TIMEOUT]',
        evaluation: { passed: false, score: 0, feedback: 'Too slow' },
        timestamp: Date.now()
      });

      session.currentPromptIndex++;
      session.silenceWarnings = 0;

      if (session.currentPromptIndex >= 25) {
        return this.completeQuickfireSession(session);
      }

      return {
        success: true,
        aiResponse: "Next one.",
        coachTag: "PROMPT",
        nextPrompt: this.serveNextPrompt(session)
      };
    }

    // First silence warning
    const impatiencePhases = [
      "Hello? Are you still with me?",
      "Can you hear me?",
      "Just checking you're there…",
      "Still on the line?",
      "I don't have much time for this."
    ];

    const phrase = impatiencePhases[Math.floor(Math.random() * impatiencePhases.length)];

    return {
      success: true,
      aiResponse: phrase,
      coachTag: "REMIND",
      state: {
        phase: "quickfire",
        promptCount: session.currentPromptIndex,
        awaitingSkipConfirm: false,
        silenceWarnings: session.silenceWarnings
      }
    };
  }

  // Evaluate quickfire response
  evaluateQuickfireResponse(userInput, rubricType) {
    const rubric = this.rubrics[rubricType];
    if (!rubric) {
      return { passed: false, score: 0, feedback: 'Unknown rubric type' };
    }

    const input = userInput.toLowerCase();
    let score = 0;
    let feedback = [];

    switch (rubricType) {
      case 'opener':
        score = this.evaluateOpenerQuickfire(userInput);
        break;
      case 'miniPitch':
        score = this.evaluateMiniPitchQuickfire(userInput);
        break;
      case 'meetingAsk':
        score = this.evaluateMeetingAskQuickfire(userInput);
        break;
      case 'earlyObjection':
      case 'postPitchObjection':
        score = this.evaluateObjectionQuickfire(userInput);
        break;
      default:
        score = 2; // Default passing score
    }

    const passed = score >= 3;

    if (!passed) {
      feedback.push(this.getQuickfireFeedback(rubricType, userInput));
    }

    return {
      passed,
      score,
      feedback: feedback.join('. ') || 'Good response!',
      rubricType
    };
  }

  // Evaluate opener for quickfire
  evaluateOpenerQuickfire(userInput) {
    const input = userInput.toLowerCase();
    let score = 0;

    // Clear opener
    if (/hello|hi|good morning|my name|this is/i.test(userInput)) score += 1;

    // Casual tone
    if (/don't|won't|can't|i'm|you're|we're/i.test(userInput)) score += 1;

    // Empathy
    if (/out of the blue|don't know me|cold call|random|unfamiliar/i.test(userInput)) score += 1;

    // Question
    if (userInput.includes('?') && /can i|may i|would you/i.test(userInput)) score += 1;

    return score;
  }

  // Evaluate mini pitch for quickfire
  evaluateMiniPitchQuickfire(userInput) {
    const sentences = userInput.split(/[.!]/).filter(s => s.trim());
    let score = 0;

    // Short
    if (sentences.length <= 2) score += 1;

    // Outcome focused
    if (/help|save|increase|improve|reduce|solve/i.test(userInput)) score += 1;

    // Simple language
    if (!/leverage|utilize|optimize|synergize/i.test(userInput)) score += 1;

    // Natural tone
    if (/we're|don't|can't|you're/i.test(userInput)) score += 1;

    return score;
  }

  // Evaluate meeting ask for quickfire
  evaluateMeetingAskQuickfire(userInput) {
    const input = userInput.toLowerCase();
    let score = 0;

    // Meeting ask
    if (/meeting|call|chat|discuss/i.test(userInput)) score += 1;

    // Concrete time
    if (/monday|tuesday|wednesday|thursday|friday|tomorrow|next week|morning|afternoon/i.test(userInput)) score += 1;

    // Question format
    if (userInput.includes('?')) score += 1;

    // Confident tone
    if (!/maybe|perhaps|if you want/i.test(userInput)) score += 1;

    return score;
  }

  // Evaluate objection handling for quickfire
  evaluateObjectionQuickfire(userInput) {
    const input = userInput.toLowerCase();
    let score = 0;

    // Acknowledgment
    if (/fair enough|totally get|i understand|i hear you|makes sense/i.test(userInput)) score += 1;

    // No arguing
    if (!/but |however |actually /i.test(userInput)) score += 1;

    // Reframe
    if (/reason i called|quick question|curious|wondering/i.test(userInput)) score += 1;

    // Forward question
    if (userInput.includes('?') && /can i|may i|would you|what if/i.test(userInput)) score += 1;

    return score;
  }

  // Get feedback for failed responses
  getQuickfireFeedback(rubricType, userInput) {
    const feedbackMap = {
      opener: "Include empathy (I know this is out of the blue...) and end with a question",
      miniPitch: "Keep it short, focus on outcomes, use casual tone",
      meetingAsk: "Ask for a meeting with specific time (Tuesday 2pm)",
      earlyObjection: "Acknowledge (Fair enough) then ask a forward-moving question",
      postPitchObjection: "Acknowledge calmly and reframe with a question"
    };

    return feedbackMap[rubricType] || "Try to improve your response";
  }

  // Complete quickfire session
  completeQuickfireSession(session) {
    const passed = session.correctAnswers >= 18;
    const percentageScore = Math.round((session.correctAnswers / 25) * 100);

    logger.log('⚡ Quickfire session completed:', {
      correctAnswers: session.correctAnswers,
      passed,
      percentageScore
    });

    const aiResponse = passed 
      ? `Great job—you scored ${session.correctAnswers}/25 and unlocked Power Hour for the next 24 hours!`
      : `You scored ${session.correctAnswers}/25. Keep practising—want to try again? (yes/no)`;

    return {
      success: true,
      aiResponse,
      coachTag: "EVAL",
      state: {
        phase: "ended",
        promptCount: 25,
        awaitingSkipConfirm: false,
        remainingPrompts: []
      },
      sessionComplete: true,
      sessionPassed: passed,
      metrics: {
        totalQuestions: 25,
        correctAnswers: session.correctAnswers,
        averageScore: (session.correctAnswers / 25) * 4,
        percentageScore,
        responses: session.responses
      }
    };
  }

  // Utility function to check if input is skip request
  isSkipRequest(userInput) {
    if (!userInput) return false;
    const input = userInput.toLowerCase().trim();
    return input.includes('pass') || input.includes('skip') || 
           input.includes('yes skip') || input === 'no';
  }

  // Utility function to shuffle array
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// Power Hour Mode Implementation
export class PowerHourMode {
  constructor() {
    this.callDistribution = {
      noAnswer: 0.55,        // 50-60%
      immediateHangup: 0.125, // 10-15%
      fullCall: 0.275        // 25-30%
    };
    
    this.objectionLists = {
      earlyStage: [
        "What's this about?", "I'm not interested", "We don't take cold calls",
        "Now is not a good time", "I have a meeting", "Can you call me later?",
        "Send me an email", "Who gave you this number?", "Is this a sales call?",
        "We're not looking for anything right now"
      ],
      postPitch: [
        "It's too expensive for us.", "We have no budget right now.",
        "Your competitor is cheaper.", "This isn't a good time.",
        "We already use a competitor and we're happy.", "I'm not the decision-maker.",
        "How long does this take to implement?"
      ]
    };
  }

  // Start power hour session
  async startPowerHourSession(userId, userProfile) {
    try {
      logger.log('🔥 Starting power hour session for user:', userId);

      const session = {
        id: `power_hour_${Date.now()}`,
        userId,
        userProfile,
        currentCall: 1,
        totalCalls: 20,
        callResults: [],
        meetingsBooked: 0,
        noAnswerCalls: 0,
        immediateHangups: 0,
        fullCalls: 0,
        startedAt: new Date().toISOString(),
        phase: 'calling'
      };

      // Start first call
      const firstCall = this.generateNextCall(session);
      
      return {
        success: true,
        session,
        ...firstCall
      };

    } catch (error) {
      logger.error('❌ Error starting power hour session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate next call based on distribution
  generateNextCall(session) {
    const random = Math.random();
    let callType;

    if (random < this.callDistribution.noAnswer) {
      callType = 'no_answer';
    } else if (random < this.callDistribution.noAnswer + this.callDistribution.immediateHangup) {
      callType = 'immediate_hangup';
    } else {
      callType = 'full_call';
    }

    logger.log('🔥 Generating call type:', callType, 'for call', session.currentCall);

    switch (callType) {
      case 'no_answer':
        return this.handleNoAnswer(session);
      case 'immediate_hangup':
        return this.handleImmediateHangup(session);
      case 'full_call':
        return this.startFullCall(session);
      default:
        return this.handleNoAnswer(session);
    }
  }

  // Handle no answer call
  handleNoAnswer(session) {
    session.noAnswerCalls++;
    session.callResults.push({
      callNumber: session.currentCall,
      type: 'no_answer',
      result: 'no_answer',
      timestamp: Date.now()
    });

    session.currentCall++;

    if (session.currentCall > 20) {
      return this.completePowerHourSession(session);
    }

    return {
      success: true,
      aiResponse: "No answer. Trying the next number.",
      coachTag: "PROMPT",
      callType: 'no_answer',
      nextCall: true,
      stats: this.getPowerHourStats(session)
    };
  }

  // Handle immediate hangup call
  handleImmediateHangup(session) {
    session.immediateHangups++;
    
    // Start the call normally, but prospect will hang up after opener
    session.currentCallState = {
      type: 'immediate_hangup',
      stage: 'greeting',
      willHangupAfter: 'opener'
    };

    return {
      success: true,
      aiResponse: "Hello?",
      coachTag: "PROMPT",
      callType: 'immediate_hangup',
      stage: 'greeting',
      stats: this.getPowerHourStats(session)
    };
  }

  // Start full call
  startFullCall(session) {
    session.fullCalls++;
    
    session.currentCallState = {
      type: 'full_call',
      stage: 'greeting',
      exchanges: 0,
      evaluations: [],
      usedObjections: new Set()
    };

    return {
      success: true,
      aiResponse: "Hello?",
      coachTag: "PROMPT", 
      callType: 'full_call',
      stage: 'greeting',
      stats: this.getPowerHourStats(session)
    };
  }

  // Process user input during power hour
  async processPowerHourInput(session, userInput) {
    try {
      if (!session.currentCallState) {
        // Between calls, start next one
        return this.generateNextCall(session);
      }

      const callState = session.currentCallState;
      
      if (callState.type === 'immediate_hangup') {
        return this.handleImmediateHangupFlow(session, userInput, callState);
      } else if (callState.type === 'full_call') {
        return this.handleFullCallFlow(session, userInput, callState);
      }

      return {
        success: false,
        error: 'Unknown call state'
      };

    } catch (error) {
      logger.error('❌ Error processing power hour input:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle immediate hangup flow
  handleImmediateHangupFlow(session, userInput, callState) {
    if (callState.stage === 'greeting') {
      // User gave opener, prospect hangs up immediately
      const hangupResponses = [
        "Not interested.",
        "Don't call again.",
        "We don't take cold calls.",
        "I'm busy."
      ];

      const response = hangupResponses[Math.floor(Math.random() * hangupResponses.length)];

      // Record call result
      session.callResults.push({
        callNumber: session.currentCall,
        type: 'immediate_hangup',
        result: 'failed',
        reason: 'immediate_hangup',
        timestamp: Date.now()
      });

      session.currentCall++;
      session.currentCallState = null;

      if (session.currentCall > 20) {
        return this.completePowerHourSession(session);
      }

      return {
        success: true,
        aiResponse: response,
        coachTag: "PROMPT",
        shouldHangUp: true,
        nextCall: true,
        stats: this.getPowerHourStats(session)
      };
    }

    return { success: false, error: 'Invalid state for immediate hangup' };
  }

  // Handle full call flow
  async handleFullCallFlow(session, userInput, callState) {
    // This follows the same logic as standard roleplay but simplified
    const evaluation = this.evaluatePowerHourResponse(userInput, callState.stage);
    
    callState.evaluations.push({
      stage: callState.stage,
      userInput,
      evaluation,
      timestamp: Date.now()
    });

    callState.exchanges++;

    if (!evaluation.passed) {
      // Call failed, prospect hangs up
      return this.endPowerHourCall(session, false, 'rubric_failure');
    }

    // Progress to next stage or end call
    const nextStage = this.getNextPowerHourStage(callState.stage);
    
    if (nextStage === 'end') {
      // Call successful, meeting booked
      return this.endPowerHourCall(session, true, 'meeting_booked');
    }

    // Continue call
    callState.stage = nextStage;
    const aiResponse = await this.generatePowerHourResponse(callState.stage, callState);

    return {
      success: true,
      aiResponse,
      coachTag: "PROMPT",
      stage: nextStage,
      evaluation,
      stats: this.getPowerHourStats(session)
    };
  }

  // End power hour call
  endPowerHourCall(session, passed, reason) {
    if (passed) {
      session.meetingsBooked++;
    }

    session.callResults.push({
      callNumber: session.currentCall,
      type: 'full_call',
      result: passed ? 'meeting_booked' : 'failed',
      reason,
      evaluations: session.currentCallState.evaluations,
      timestamp: Date.now()
    });

    session.currentCall++;
    session.currentCallState = null;

    const responseMessage = passed 
      ? "Perfect! I'll send you a calendar invite. Looking forward to our meeting!"
      : "I'm not interested. Thanks anyway.";

    if (session.currentCall > 20) {
      return this.completePowerHourSession(session);
    }

    return {
      success: true,
      aiResponse: responseMessage,
      coachTag: "PROMPT",
      shouldHangUp: true,
      nextCall: true,
      callResult: { passed, reason },
      stats: this.getPowerHourStats(session)
    };
  }

  // Complete power hour session
  completePowerHourSession(session) {
    const previousBest = 0; // This should come from user's history
    const isNewRecord = session.meetingsBooked > previousBest;

    const summary = `📊 Power Hour Results
• Calls answered: ${session.noAnswerCalls + session.immediateHangups + session.fullCalls}/20
• Full cold calls: ${session.fullCalls}
• Meetings booked: ${session.meetingsBooked}
${isNewRecord ? '🎉 New personal record—great job!' : 'Keep pushing—try again to beat your score.'}

Want to try another Power Hour? (yes/no)`;

    return {
      success: true,
      aiResponse: summary,
      coachTag: "EVAL",
      sessionComplete: true,
      sessionPassed: true, // Power hour always "passes"
      metrics: {
        totalCalls: 20,
        callsAnswered: session.noAnswerCalls + session.immediateHangups + session.fullCalls,
        fullCalls: session.fullCalls,
        meetingsBooked: session.meetingsBooked,
        noAnswerCalls: session.noAnswerCalls,
        immediateHangups: session.immediateHangups,
        callResults: session.callResults,
        isNewRecord
      }
    };
  }

  // Get power hour statistics
  getPowerHourStats(session) {
    return {
      currentCall: session.currentCall,
      totalCalls: 20,
      meetingsBooked: session.meetingsBooked,
      noAnswerCalls: session.noAnswerCalls,
      immediateHangups: session.immediateHangups,
      fullCalls: session.fullCalls
    };
  }

  // Evaluate power hour response (simplified)
  evaluatePowerHourResponse(userInput, stage) {
    const input = userInput.toLowerCase();
    let score = 2; // Base score

    // Simple evaluation based on stage
    switch (stage) {
      case 'opener':
        if (/hello|hi|my name|this is/i.test(userInput)) score += 1;
        if (/don't|can't|i'm/i.test(userInput)) score += 1;
        break;
      case 'objection':
        if (/fair enough|understand|get that/i.test(userInput)) score += 1;
        if (userInput.includes('?')) score += 1;
        break;
      case 'pitch':
        if (/help|save|improve/i.test(userInput)) score += 1;
        if (userInput.split(' ').length <= 30) score += 1;
        break;
      case 'meeting_ask':
        if (/meeting|call|chat/i.test(userInput)) score += 1;
        if (/monday|tuesday|wednesday|thursday|friday/i.test(userInput)) score += 1;
        break;
    }

    return {
      passed: score >= 3,
      score,
      feedback: score >= 3 ? 'Good response!' : 'Could be improved'
    };
  }

  // Get next stage in power hour call
  getNextPowerHourStage(currentStage) {
    const stageFlow = {
      greeting: 'opener',
      opener: 'objection', 
      objection: 'pitch',
      pitch: 'meeting_ask',
      meeting_ask: 'end'
    };

    return stageFlow[currentStage] || 'end';
  }

  // Generate AI response for power hour
  async generatePowerHourResponse(stage, callState) {
    switch (stage) {
      case 'objection':
        const objection = this.getRandomObjection('earlyStage', callState.usedObjections);
        callState.usedObjections.add(objection);
        return objection;
      case 'pitch':
        return "Alright, go ahead — what's this about?";
      case 'meeting_ask':
        return "That sounds interesting. What did you have in mind?";
      default:
        return "I see. Tell me more.";
    }
  }

  // Get random objection
  getRandomObjection(type, usedObjections) {
    const objections = this.objectionLists[type];
    const availableObjections = objections.filter(obj => !usedObjections.has(obj));
    
    if (availableObjections.length === 0) {
      return objections[Math.floor(Math.random() * objections.length)];
    }
    
    return availableObjections[Math.floor(Math.random() * availableObjections.length)];
  }
}

// Create and export singleton instances
export const quickfireMode = new QuickfireMode();
export const powerHourMode = new PowerHourMode();
export default { quickfireMode, powerHourMode };