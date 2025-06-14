// src/__tests__/services/VoiceService.test.js
import { voiceService } from '../../services/voiceService';

describe('VoiceService', () => {
  test('should check compatibility', () => {
    const compatibility = voiceService.checkCompatibility();
    expect(compatibility).toHaveProperty('compatible');
    expect(compatibility).toHaveProperty('issues');
    expect(compatibility).toHaveProperty('features');
  });

  test('should estimate speech duration', () => {
    const duration = voiceService.estimateSpeechDuration('Hello world this is a test');
    expect(duration).toBeGreaterThan(0);
    expect(typeof duration).toBe('number');
  });

  test('should clean up properly', () => {
    voiceService.cleanup();
    expect(voiceService.isListening).toBe(false);
    expect(voiceService.isSpeaking).toBe(false);
  });
});