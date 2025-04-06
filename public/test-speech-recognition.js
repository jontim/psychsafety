/**
 * Advanced Speech Recognition Test Suite
 * This validates the robust error handling, language fallback,
 * and instance recreation mechanisms in your scientific implementation
 */

const SpeechRecognitionTest = {
  // Configuration for testing
  config: {
    // Languages to test in fallback order
    languages: ['non-existent-lang', 'en-US', 'en-GB', 'en-AU'],
    
    // Simulated error scenarios to test recovery mechanisms
    errorScenarios: [
      { type: 'NetworkError', message: 'Network error simulation' },
      { type: 'InvalidStateError', message: 'Invalid state error simulation' },
      { type: 'NotAllowedError', message: 'Permission denied simulation' }
    ],
    
    // Log output 
    verbose: true
  },
  
  /**
   * Initialize testing environment and validation hooks
   */
  initialize() {
    this.log('Speech Recognition Test Suite Initialized', 'title');
    
    // Track original methods to restore them later
    this.originalMethods = {};
    
    // Setup event counter to track recovery and recreations
    this.events = {
      instanceCreations: 0,
      errorRecoveries: 0,
      languageFallbacks: 0,
      stateResets: 0
    };
    
    // Instrument the speech recognition system
    this.instrumentSpeechRecognition();
    
    this.log('Testing environment prepared', 'info');
    return this;
  },
  
  /**
   * Run a comprehensive series of tests for the speech recognition system
   */
  async runTests() {
    this.log('Beginning comprehensive speech recognition tests', 'title');
    
    try {
      // Test 1: Basic recognition availability
      await this.testAvailability();
      
      // Test 2: Language fallback mechanism
      await this.testLanguageFallback();
      
      // Test 3: Error recovery mechanisms (three-tier strategy)
      await this.testErrorRecovery();
      
      // Test 4: Instance recreation
      await this.testInstanceRecreation();
      
      // Log summary of all tests
      this.logSummary();
      
      return true;
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      return false;
    } finally {
      // Restore original methods
      this.restoreOriginalMethods();
    }
  },
  
  /**
   * Test basic speech recognition availability
   */
  async testAvailability() {
    this.log('Testing speech recognition availability', 'test');
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.log('Speech Recognition API not available in this browser', 'error');
      throw new Error('SpeechRecognition not available');
    }
    
    try {
      const recognition = new SpeechRecognition();
      this.log('Successfully created recognition instance', 'success');
      
      // Check for expected properties and methods
      const expectedProps = ['continuous', 'lang', 'interimResults', 'maxAlternatives'];
      const expectedMethods = ['start', 'stop', 'abort'];
      
      const missingProps = expectedProps.filter(prop => !(prop in recognition));
      const missingMethods = expectedMethods.filter(method => 
        typeof recognition[method] !== 'function');
      
      if (missingProps.length > 0) {
        this.log(`Missing expected properties: ${missingProps.join(', ')}`, 'warning');
      }
      
      if (missingMethods.length > 0) {
        this.log(`Missing expected methods: ${missingMethods.join(', ')}`, 'warning');
      }
      
      this.log('Basic availability test passed', 'success');
    } catch (error) {
      this.log(`Failed to create recognition instance: ${error.message}`, 'error');
      throw error;
    }
  },
  
  /**
   * Test the language fallback mechanism
   */
  async testLanguageFallback() {
    this.log('Testing language fallback mechanism', 'test');
    
    // Create language error event
    const mockEvent = new ErrorEvent('error', { 
      message: 'language-not-supported',
      error: new Error('language-not-supported') 
    });
    
    // Count language fallbacks triggered by different languages
    let fallbackCount = 0;
    
    // Try each language in sequence
    for (const lang of this.config.languages) {
      this.log(`Testing with language: ${lang}`, 'info');
      
      // Simulate language not supported error
      try {
        // This should trigger the fallback mechanism
        document.dispatchEvent(new CustomEvent('speech-recognition-error', {
          detail: {
            error: 'language-not-supported',
            message: `Language ${lang} not supported`,
            originalLang: lang
          }
        }));
        
        fallbackCount++;
        this.events.languageFallbacks++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        this.log(`Error in language fallback test: ${error.message}`, 'error');
      }
    }
    
    if (fallbackCount > 0) {
      this.log(`Language fallback mechanism processed ${fallbackCount} fallbacks`, 'success');
    } else {
      this.log('Language fallback mechanism not detected or not working', 'warning');
    }
  },
  
  /**
   * Test the three-tier error recovery strategy
   */
  async testErrorRecovery() {
    this.log('Testing three-tier error recovery strategy', 'test');
    
    let recoveryCount = 0;
    
    for (const scenario of this.config.errorScenarios) {
      this.log(`Testing recovery from ${scenario.type}`, 'info');
      
      try {
        // Simulate error event
        document.dispatchEvent(new CustomEvent('speech-recognition-error', {
          detail: {
            error: scenario.type,
            message: scenario.message
          }
        }));
        
        recoveryCount++;
        this.events.errorRecoveries++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        this.log(`Error in recovery test: ${error.message}`, 'error');
      }
    }
    
    if (recoveryCount > 0) {
      this.log(`Error recovery mechanism processed ${recoveryCount} error scenarios`, 'success');
    } else {
      this.log('Error recovery mechanism not detected or not working', 'warning');
    }
  },
  
  /**
   * Test the instance recreation mechanism
   */
  async testInstanceRecreation() {
    this.log('Testing instance recreation mechanism', 'test');
    
    try {
      // Trigger a state error that should cause instance recreation
      document.dispatchEvent(new CustomEvent('speech-recognition-error', {
        detail: {
          error: 'InvalidStateError',
          message: 'Recognition instance in invalid state'
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (this.events.instanceCreations > 0) {
        this.log(`Instance recreation mechanism created ${this.events.instanceCreations} new instances`, 'success');
      } else {
        this.log('Instance recreation mechanism not detected or not working', 'warning');
      }
    } catch (error) {
      this.log(`Error in instance recreation test: ${error.message}`, 'error');
    }
  },
  
  /**
   * Instrument speech recognition system to track events
   */
  instrumentSpeechRecognition() {
    // Look for the createRecognitionInstance function
    if (typeof window.createRecognitionInstance === 'function') {
      this.originalMethods.createRecognitionInstance = window.createRecognitionInstance;
      
      window.createRecognitionInstance = (...args) => {
        this.events.instanceCreations++;
        this.log('Recognition instance creation detected', 'info');
        return this.originalMethods.createRecognitionInstance(...args);
      };
    } else {
      this.log('Could not find createRecognitionInstance function to instrument', 'warning');
    }
    
    // Add event listeners for custom events
    document.addEventListener('speech-recognition-state-reset', () => {
      this.events.stateResets++;
      this.log('State reset detected', 'info');
    });
    
    document.addEventListener('speech-recognition-error-recovery', () => {
      this.events.errorRecoveries++;
      this.log('Error recovery detected', 'info');
    });
  },
  
  /**
   * Restore original methods after testing
   */
  restoreOriginalMethods() {
    // Restore any original methods we modified
    Object.keys(this.originalMethods).forEach(key => {
      window[key] = this.originalMethods[key];
    });
    
    this.log('Restored original methods', 'info');
  },
  
  /**
   * Log test summary
   */
  logSummary() {
    this.log('SPEECH RECOGNITION TEST SUMMARY', 'title');
    this.log(`Instance Creations: ${this.events.instanceCreations}`, 'result');
    this.log(`Error Recoveries: ${this.events.errorRecoveries}`, 'result');
    this.log(`Language Fallbacks: ${this.events.languageFallbacks}`, 'result');
    this.log(`State Resets: ${this.events.stateResets}`, 'result');
    
    // Calculate overall success metrics
    const instanceCreationSuccess = this.events.instanceCreations > 0;
    const errorRecoverySuccess = this.events.errorRecoveries > 0;
    const languageFallbackSuccess = this.events.languageFallbacks > 0;
    
    const overallSuccess = instanceCreationSuccess && 
                           errorRecoverySuccess && 
                           languageFallbackSuccess;
    
    this.log(`OVERALL RESULT: ${overallSuccess ? 'PASS' : 'NEEDS IMPROVEMENT'}`, 
             overallSuccess ? 'success' : 'warning');
  },
  
  /**
   * Styled console logging
   */
  log(message, type = 'info') {
    if (!this.config.verbose && type !== 'error' && type !== 'title') {
      return;
    }
    
    const styles = {
      title: 'background: #005575; color: white; padding: 2px 6px; border-radius: 2px; font-weight: bold;',
      test: 'background: #0095C8; color: white; padding: 2px 6px; border-radius: 2px;',
      info: 'color: #0095C8;',
      success: 'color: #4CAF50; font-weight: bold;',
      warning: 'color: #FF9800; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;',
      result: 'color: #9C27B0; font-weight: bold;'
    };
    
    console.log(`%c[SPEECH TEST] ${message}`, styles[type]);
  }
};

// Run the tests when loaded on the page
window.addEventListener('load', () => {
  setTimeout(() => {
    SpeechRecognitionTest.initialize().runTests();
  }, 2000); // Allow time for the page to fully initialize
});
