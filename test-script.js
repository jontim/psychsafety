/**
 * Comprehensive Test Script for PsychSafetyAgentInterface
 * Tests all critical functionality while preserving scientific integrity
 */

// Test configuration
const config = {
  coaches: ['niles', 'caroline', 'lorraine', 'mathew'],
  testMessages: [
    "I've been feeling stressed about giving feedback to my team",
    "My colleague doesn't listen during meetings",
    "I'm having trouble communicating with my manager"
  ],
  logResults: true
};

// Utility testing functions
const TestUtils = {
  log: function(message, type = 'info') {
    if (config.logResults) {
      const styles = {
        'info': 'color: #0095C8',
        'success': 'color: #4CAF50; font-weight: bold',
        'error': 'color: #F44336; font-weight: bold',
        'warning': 'color: #FF9800'
      };
      console.log(`%c[TEST] ${message}`, styles[type]);
    }
  },
  
  testLocalStorage: function() {
    try {
      localStorage.setItem('test', 'test');
      if (localStorage.getItem('test') === 'test') {
        localStorage.removeItem('test');
        this.log('LocalStorage is working correctly', 'success');
        return true;
      }
      return false;
    } catch (e) {
      this.log('LocalStorage test failed: ' + e.message, 'error');
      return false;
    }
  },
  
  testSpeechRecognition: function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.log('Speech Recognition not supported in this browser', 'warning');
      return false;
    }
    this.log('Speech Recognition is available', 'success');
    return true;
  },
  
  testImageLoading: function(coachId) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.log(`Image for coach ${coachId} loaded successfully`, 'success');
        resolve(true);
      };
      img.onerror = () => {
        this.log(`Failed to load image for coach ${coachId}`, 'error');
        resolve(false);
      };
      img.src = `${coachId}-session.png`;
    });
  },
  
  testAudioContext: function() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      this.log('Audio Context created successfully', 'success');
      context.close();
      return true;
    } catch (e) {
      this.log('Audio Context failed: ' + e.message, 'error');
      return false;
    }
  }
};

// Main test runner
async function runTests() {
  TestUtils.log('Starting comprehensive tests', 'info');
  
  // Test browser capabilities
  TestUtils.log('Testing browser capabilities...', 'info');
  const storageWorks = TestUtils.testLocalStorage();
  const speechWorks = TestUtils.testSpeechRecognition();
  const audioWorks = TestUtils.testAudioContext();
  
  // Test coach image loading
  TestUtils.log('Testing coach image loading...', 'info');
  const imageResults = await Promise.all(
    config.coaches.map(coach => TestUtils.testImageLoading(coach))
  );
  
  // Test DOM elements
  TestUtils.log('Testing critical DOM elements...', 'info');
  const domTests = {
    'coach-video': !!document.querySelector('.coach-video'),
    'dial-pad': !!document.querySelector('.dial-pad'),
    'action-buttons': document.querySelectorAll('.phone-action-button').length === 4
  };
  
  Object.entries(domTests).forEach(([test, result]) => {
    TestUtils.log(`DOM test for ${test}: ${result ? 'PASS' : 'FAIL'}`, result ? 'success' : 'error');
  });
  
  // Summary
  const allTestsPassed = storageWorks && speechWorks && audioWorks && 
                         imageResults.every(r => r) && 
                         Object.values(domTests).every(v => v);
  
  TestUtils.log(`Test Summary: ${allTestsPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`, 
                allTestsPassed ? 'success' : 'error');
                
  return {
    browserCapabilities: { storageWorks, speechWorks, audioWorks },
    imageLoading: imageResults,
    domElements: domTests,
    allTestsPassed
  };
}

// Run the tests when this script is loaded
if (document.readyState === 'complete') {
  runTests();
} else {
  window.addEventListener('load', runTests);
}
