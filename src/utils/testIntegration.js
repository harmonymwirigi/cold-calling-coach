// src/utils/testIntegration.js - Run this to test all integrations
import { openAIService } from '../services/openaiService';
import { voiceService } from '../services/voiceService';
import logger from './logger';

export const testAllIntegrations = async () => {
  console.log('🧪 Starting Integration Tests...\n');
  
  const results = {
    openAI: { status: 'pending', details: null },
    voiceService: { status: 'pending', details: null },
    awsPolly: { status: 'pending', details: null },
    browserSpeech: { status: 'pending', details: null },
    speechRecognition: { status: 'pending', details: null },
    overall: true
  };

  // Test 1: OpenAI Service
  console.log('1️⃣ Testing OpenAI Service...');
  try {
    await openAIService.initialize();
    
    // Test a simple evaluation
    const testInput = "Hi Sarah, I know this is out of the blue, but I'm calling from TechCorp. Can I tell you why I'm calling?";
    const response = await openAIService.getProspectResponse(
      testInput,
      { roleplayType: 'opener_practice', mode: 'practice' },
      'opener'
    );
    
    if (response.success && response.response) {
      results.openAI.status = 'passed';
      results.openAI.details = {
        response: response.response,
        evaluation: response.evaluation,
        stage: response.stage
      };
      console.log('✅ OpenAI Service: PASSED');
      console.log('   Response:', response.response);
      console.log('   Evaluation:', response.evaluation?.passed ? 'PASSED' : 'FAILED');
    } else {
      throw new Error('No response from OpenAI');
    }
  } catch (error) {
    results.openAI.status = 'failed';
    results.openAI.details = error.message;
    results.overall = false;
    console.log('❌ OpenAI Service: FAILED');
    console.log('   Error:', error.message);
  }

  // Test 2: Voice Service Initialization
  console.log('\n2️⃣ Testing Voice Service Initialization...');
  try {
    const initialized = await voiceService.initialize();
    const state = voiceService.getState();
    
    results.voiceService.status = initialized ? 'passed' : 'failed';
    results.voiceService.details = state;
    
    if (initialized) {
      console.log('✅ Voice Service: INITIALIZED');
      console.log('   State:', state);
    } else {
      throw new Error('Voice service failed to initialize');
    }
  } catch (error) {
    results.voiceService.status = 'failed';
    results.voiceService.details = error.message;
    results.overall = false;
    console.log('❌ Voice Service: FAILED');
    console.log('   Error:', error.message);
  }

  // Test 3: AWS Polly
  console.log('\n3️⃣ Testing AWS Polly...');
  try {
    const state = voiceService.getState();
    
    if (state.pollyEnabled) {
      // Test Polly synthesis
      await voiceService.speakText("Testing AWS Polly synthesis.", {
        voiceId: 'Joanna'
      });
      
      results.awsPolly.status = 'passed';
      results.awsPolly.details = 'AWS Polly is working correctly';
      console.log('✅ AWS Polly: PASSED');
    } else {
      results.awsPolly.status = 'skipped';
      results.awsPolly.details = 'AWS Polly not configured (using browser fallback)';
      console.log('⚠️  AWS Polly: NOT CONFIGURED (This is OK - browser fallback will be used)');
    }
  } catch (error) {
    results.awsPolly.status = 'failed';
    results.awsPolly.details = error.message;
    console.log('❌ AWS Polly: FAILED');
    console.log('   Error:', error.message);
  }

  // Test 4: Browser Speech Synthesis
  console.log('\n4️⃣ Testing Browser Speech Synthesis...');
  try {
    if ('speechSynthesis' in window) {
      await voiceService.speakText("Testing browser speech synthesis.");
      
      results.browserSpeech.status = 'passed';
      results.browserSpeech.details = 'Browser speech synthesis is working';
      console.log('✅ Browser Speech: PASSED');
    } else {
      throw new Error('Browser does not support speech synthesis');
    }
  } catch (error) {
    results.browserSpeech.status = 'failed';
    results.browserSpeech.details = error.message;
    results.overall = false;
    console.log('❌ Browser Speech: FAILED');
    console.log('   Error:', error.message);
  }

  // Test 5: Speech Recognition
  console.log('\n5️⃣ Testing Speech Recognition...');
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      results.speechRecognition.status = 'passed';
      results.speechRecognition.details = 'Speech recognition is available';
      console.log('✅ Speech Recognition: AVAILABLE');
    } else {
      throw new Error('Browser does not support speech recognition');
    }
  } catch (error) {
    results.speechRecognition.status = 'failed';
    results.speechRecognition.details = error.message;
    console.log('❌ Speech Recognition: FAILED');
    console.log('   Error:', error.message);
  }

  // Summary
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  console.log('OpenAI Service:', results.openAI.status.toUpperCase());
  console.log('Voice Service:', results.voiceService.status.toUpperCase());
  console.log('AWS Polly:', results.awsPolly.status.toUpperCase());
  console.log('Browser Speech:', results.browserSpeech.status.toUpperCase());
  console.log('Speech Recognition:', results.speechRecognition.status.toUpperCase());
  console.log('');
  console.log('Overall Result:', results.overall ? '✅ READY' : '❌ ISSUES FOUND');
  
  if (!results.overall) {
    console.log('\n⚠️  Some tests failed. Check the details above.');
    console.log('Note: AWS Polly is optional - the app will work with browser speech synthesis.');
  }

  return results;
};

// Browser compatibility check
export const checkBrowserCompatibility = () => {
  const compatibility = {
    browser: '',
    supported: true,
    issues: [],
    recommendations: []
  };

  // Detect browser
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome')) {
    compatibility.browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    compatibility.browser = 'Firefox';
  } else if (userAgent.includes('Safari')) {
    compatibility.browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    compatibility.browser = 'Edge';
  } else {
    compatibility.browser = 'Unknown';
  }

  // Check features
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    compatibility.supported = false;
    compatibility.issues.push('Speech recognition not supported');
    compatibility.recommendations.push('Use Chrome or Edge for best experience');
  }

  if (!('speechSynthesis' in window)) {
    compatibility.supported = false;
    compatibility.issues.push('Speech synthesis not supported');
    compatibility.recommendations.push('Update your browser to the latest version');
  }

  if (!('mediaDevices' in navigator)) {
    compatibility.supported = false;
    compatibility.issues.push('Media devices API not supported');
    compatibility.recommendations.push('Ensure you are using HTTPS');
  }

  console.log('🌐 Browser Compatibility:');
  console.log('Browser:', compatibility.browser);
  console.log('Fully Supported:', compatibility.supported);
  
  if (compatibility.issues.length > 0) {
    console.log('Issues:', compatibility.issues);
    console.log('Recommendations:', compatibility.recommendations);
  }

  return compatibility;
};

// Run all tests
export const runAllTests = async () => {
  console.clear();
  console.log('🚀 COLD CALLING COACH - INTEGRATION TEST SUITE\n');
  
  // Check browser first
  checkBrowserCompatibility();
  console.log('');
  
  // Run integration tests
  await testAllIntegrations();
  
  console.log('\n✅ Tests complete! Check the results above.');
  console.log('💡 Tip: If AWS Polly is not configured, the app will use browser speech synthesis as a fallback.');
};

// Export for use in console
window.runIntegrationTests = runAllTests;