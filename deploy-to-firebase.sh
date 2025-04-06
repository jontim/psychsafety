#!/bin/bash
# Firebase Deployment Script for Growth Unlimited Coaching Application
# This script prepares and deploys the application to Firebase

# Set colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Growth Unlimited Firebase Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Verify we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo -e "${RED}Error: firebase.json not found in current directory${NC}"
  echo -e "${YELLOW}Please run this script from the root of your project${NC}"
  exit 1
fi

# Step 2: Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
  echo -e "${RED}Firebase CLI not found. Please install it with:${NC}"
  echo -e "${YELLOW}npm install -g firebase-tools${NC}"
  exit 1
fi

# Step 3: Copy the latest files from public-preview to public
echo -e "\n${GREEN}Preparing files for deployment...${NC}"

# Create public directory if it doesn't exist
mkdir -p public

# Copy all files from public-preview to public, preserving the latest versions
echo -e "${BLUE}Copying files from public-preview to public...${NC}"
rsync -av --progress public-preview/ public/

# Rename index-preview.html to index.html
if [ -f "public/index-preview.html" ]; then
  echo -e "${YELLOW}Renaming index-preview.html to index.html...${NC}"
  cp public/index-preview.html public/index.html
fi

# Create coach-selection.html from coach-selection-new-preview.html
if [ -f "public/coach-selection-new-preview.html" ]; then
  echo -e "${YELLOW}Creating coach-selection.html from coach-selection-new-preview.html...${NC}"
  cp public/coach-selection-new-preview.html public/coach-selection.html
elif [ -f "public/coach-selection-new.html" ]; then
  echo -e "${YELLOW}Creating coach-selection.html from coach-selection-new.html...${NC}"
  cp public/coach-selection-new.html public/coach-selection.html
fi

# Create the favicon if it doesn't exist
if [ ! -f "public/favicon.ico" ]; then
  echo -e "${YELLOW}Creating favicon.ico...${NC}"
  touch public/favicon.ico
fi

# Add reference to favicon in HTML files if missing
find public -type f -name "*.html" | xargs grep -l "<head" | while read file; do
  if ! grep -q "favicon.ico" "$file"; then
    echo -e "${YELLOW}Adding favicon reference to $file...${NC}"
    sed -i '' 's/<head>/<head>\n  <link rel="shortcut icon" href="favicon.ico" type="image\/x-icon">/' "$file"
  fi
done

# Step 4: Update file paths and references if needed
echo -e "\n${GREEN}Updating file references...${NC}"
# Update any ../public/ references to point to the current directory
find public -type f -name "*.html" -exec sed -i '' 's/\.\.\/public\//\.\//g' {} \;
find public -type f -name "*.js" -exec sed -i '' 's/\.\.\/public\//\.\//g' {} \;
find public -type f -name "*.css" -exec sed -i '' 's/\.\.\/public\//\.\//g' {} \;

# Update any coach-selection references to the correct format
find public -type f -name "*.html" -exec sed -i '' 's/coach-selection-new-preview\.html/coach-selection.html/g' {} \;
find public -type f -name "*.html" -exec sed -i '' 's/coach-selection-new\.html/coach-selection.html/g' {} \;

# Step 5: Verify the files exist before deployment
echo -e "\n${GREEN}Verifying critical files exist...${NC}"
CRITICAL_FILES=("index.html" "coaching-session.html" "coach-selection.html")
MISSING=0

for file in "${CRITICAL_FILES[@]}"; do
  if [ ! -f "public/$file" ]; then
    echo -e "${RED}Error: $file is missing from public directory${NC}"
    MISSING=1
  else
    echo -e "${GREEN}✓ $file exists${NC}"
  fi
done

if [ $MISSING -eq 1 ]; then
  echo -e "${YELLOW}Warning: Some critical files are missing. Do you want to continue? (y/n)${NC}"
  read -r response
  if [[ "$response" != "y" ]]; then
    echo -e "${RED}Deployment aborted.${NC}"
    exit 1
  fi
fi

# Step 6: Firebase deployment
echo -e "\n${GREEN}Starting Firebase deployment...${NC}"
echo -e "${YELLOW}This will deploy to the Firebase project configured in .firebaserc${NC}"
echo -e "${BLUE}Do you want to proceed with deployment? (y/n)${NC}"
read -r deploy

if [[ "$deploy" == "y" ]]; then
  echo -e "${GREEN}Deploying to Firebase...${NC}"
  firebase deploy
  
  if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Deployment successful!${NC}"
    echo -e "${BLUE}Your application is now live on Firebase hosting.${NC}"
    
    # Display the hosting URL if we can find it
    if [ -f ".firebaserc" ]; then
      PROJECT_ID=$(grep -o '"default": "[^"]*' .firebaserc | cut -d'"' -f4)
      if [ -n "$PROJECT_ID" ]; then
        echo -e "${GREEN}Your application is available at:${NC}"
        echo -e "${BLUE}https://$PROJECT_ID.web.app${NC}"
      fi
    fi
  else
    echo -e "\n${RED}Deployment failed.${NC}"
    echo -e "${YELLOW}Please check the error messages above.${NC}"
  fi
else
  echo -e "${YELLOW}Deployment skipped.${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment process complete${NC}"
echo -e "${BLUE}========================================${NC}"
