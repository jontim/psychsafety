#!/bin/bash
# Test and Deploy Script for PsychSafetyAgentInterface
# Preserves scientific rigor while ensuring proper testing

echo "🧪 Starting test and deployment process..."

# Step 1: Stop any existing server
echo "🛑 Stopping any existing server processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "No server running on port 8000"

# Step 2: Start a server for testing the public-preview directory
echo "🚀 Starting server for the public-preview version..."
cd "$(dirname "$0")/public-preview"
python -m http.server 8000 > /dev/null 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Step 3: Inject test script into coaching-session.html
echo "💉 Injecting test script reference into coaching session page..."
TEST_SCRIPT_REF='<script src="test-speech-recognition.js"></script>'
if grep -q "test-speech-recognition.js" "coaching-session.html"; then
  echo "Test script already injected"
else
  # Insert before the closing </body> tag
  sed -i '' "s|</body>|  $TEST_SCRIPT_REF\n</body>|" "coaching-session.html"
  echo "Test script injected successfully"
fi

echo "🌐 Open http://localhost:8000/coaching-session.html in your browser to run tests"
echo ""
echo "📋 Testing steps:"
echo "1. Check the browser console for test results"
echo "2. Try the speech recognition (microphone button)"
echo "3. Test the action buttons (video, analysis, end call)"
echo "4. Verify DTMF tones are working"
echo ""
echo "When ready to deploy to Firebase (after testing):"
echo "1. firebase deploy --only hosting"
echo ""
echo "Press Enter to continue monitoring or Ctrl+C to stop the server..."
read -r

# Cleanup
echo "Stopping server..."
kill $SERVER_PID
echo "Done!"
