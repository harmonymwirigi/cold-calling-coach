// src/__tests__/services/OpenAIService.test.js
import { openAIService } from '../../services/openaiService';

describe('OpenAIService', () => {
  beforeEach(() => {
    openAIService.resetConversation();
  });

  test('should reset conversation properly', () => {
    expect(openAIService.conversationHistory).toHaveLength(0);
    expect(openAIService.currentStage).toBe('greeting');
    expect(openAIService.usedObjections.size).toBe(0);
  });

  test('should get random objection without repeats', () => {
    const objection1 = openAIService.getRandomObjection('early');
    const objection2 = openAIService.getRandomObjection('early');
    
    expect(objection1).toBeTruthy();
    expect(objection2).toBeTruthy();
    expect(objection1).not.toBe(objection2);
  });

  test('should get impatience phrase', () => {
    const phrase = openAIService.getImpatiencePhrase();
    expect(phrase).toBeTruthy();
    expect(typeof phrase).toBe('string');
  });

  test('should evaluate basic responses', () => {
    const evaluation = openAIService.basicEvaluation("Hi there, I'm calling from...", 'greeting');
    expect(typeof evaluation).toBe('boolean');
  });
});