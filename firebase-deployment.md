# Firebase Deployment Checklist

## 1. Pre-Deployment Testing

- [ ] Test all essential functionality in development environment
- [ ] Ensure all assets (images, scripts) load correctly
- [ ] Verify that coach images display at proper size
- [ ] Confirm audio/DTMF tones work correctly
- [ ] Test speech recognition with error recovery

## 2. File Preparation

1. **Copy files from public-preview to public directory**
   - Copy only the files needed for production (no .bak files)
   - Copy all coach images and assets
   - Copy the coach-session.html file with working buttons
   
2. **Update Firebase configuration**
   - Verify firebase.json has correct routing rules
   - Add coaching-session.html to rewrites if needed

## 3. Firebase Deployment Process

```bash
# Step 1: Copy production-ready files to public directory
cp public-preview/coaching-session.html public/
cp public-preview/*-session.png public/

# Step 2: Test locally with Firebase emulator
firebase emulators:start

# Step 3: Deploy to Firebase
firebase deploy --only hosting

# Step 4: Verify deployment
# Visit your Firebase hosting URL to verify all functionality
```

## 4. Post-Deployment Verification

- [ ] Test user journey from coach selection to coaching session
- [ ] Verify coach images display correctly in production
- [ ] Test speech recognition in production environment
- [ ] Verify DTMF tones functionality
- [ ] Test all action buttons (video, analysis, end call)

## 5. Firebase Functions (if needed)

If your application requires Firebase Functions:

```bash
# Deploy only functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:functionName
```

## 6. Rollback Plan (if issues arise)

```bash
# Check deployment history
firebase hosting:versions:list

# Rollback to previous version if needed
firebase hosting:clone VERSION_ID live
```
