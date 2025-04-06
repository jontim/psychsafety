#!/bin/bash
# Prepare files for Firebase deployment
# This script preserves scientific integrity and maintains all your enhanced features

echo "🔍 Preparing files for Firebase deployment..."

# Create backup of public directory if it doesn't exist
if [ ! -d "public_backup" ]; then
  echo "📂 Creating backup of public directory..."
  cp -r public public_backup
fi

# Copy core files from public-preview to public
echo "📋 Copying production-ready files to public..."
cp public-preview/coaching-session.html public/
cp public-preview/*-session.png public/

# Copy the test script to validate functionality
cp test-script.js public/

echo "✅ Files prepared for Firebase deployment!"
echo ""
echo "To deploy to Firebase:"
echo "1. Test locally: firebase emulators:start"
echo "2. Deploy: firebase deploy --only hosting"
echo ""
echo "To validate after deployment:"
echo "1. Check coach images display at proper size"
echo "2. Verify speech recognition works with language fallbacks"
echo "3. Test that all buttons function correctly"
echo "4. Confirm DTMF tones are audible"
