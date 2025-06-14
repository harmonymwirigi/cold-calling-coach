// src/__tests__/utils/helpers.test.js
import { formatDate, formatTime, calculatePassRate } from '../../utils/helpers';

describe('Helper Functions', () => {
  test('formatDate formats dates correctly', () => {
    const date = new Date('2023-12-25');
    const formatted = formatDate(date);
    expect(formatted).toMatch(/Dec 25, 2023/);
  });

  test('formatTime formats seconds correctly', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(120)).toBe('2:00');
    expect(formatTime(30)).toBe('0:30');
  });

  test('calculatePassRate calculates correctly', () => {
    const sessions = [
      { calls_passed: 6, calls_attempted: 10 },
      { calls_passed: 8, calls_attempted: 10 },
      { calls_passed: 4, calls_attempted: 10 }
    ];
    
    const passRate = calculatePassRate(sessions);
    expect(passRate).toBe(67); // 2 out of 3 sessions passed (≥60%)
  });
});