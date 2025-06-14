// src/utils/rubrics.js
export const RUBRICS = {
    OPENER: {
      criteria: [
        'Clear cold call opener (pattern interrupt, permission-based, or value-first)',
        'Casual, confident tone (contractions, short phrases)',
        'Demonstrates empathy (acknowledges interruption/unfamiliarity)', 
        'Ends with soft question'
      ],
      passThreshold: 3
    },
    
    OBJECTION_HANDLING: {
      criteria: [
        'Acknowledges calmly ("Fair enough"/"Totally get that")',
        'Doesn\'t argue or pitch immediately',
        'Reframes or buys time in 1 sentence',
        'Ends with forward-moving question'
      ],
      passThreshold: 3
    },
    
    MINI_PITCH: {
      criteria: [
        'Short (1-2 sentences)',
        'Problem/outcome focused',
        'Simple English, no jargon',
        'Natural delivery'
      ],
      passThreshold: 3
    },
    
    MEETING_ASK: {
      criteria: [
        'Clear meeting request',
        '≥1 concrete time slot',
        'Handles push-back confidently',
        'Confident tone throughout'
      ],
      passThreshold: 4 // All must pass
    }
  };
  
  export const OBJECTIONS = {
    EARLY: [
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
    
    POST_PITCH: [
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
    ]
  };