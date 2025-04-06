#!/bin/bash
# Production build script for PsychSafetyAgentInterface
# This prepares the application for live deployment

# Create production directory
mkdir -p ./production

# Copy all html files, removing backup files
echo "Copying HTML files..."
find ./public-preview -name "*.html" -not -name "*.bak*" -exec cp {} ./production/ \;

# Copy all needed assets
echo "Copying assets..."
cp ./public-preview/*.png ./production/
cp ./public-preview/*.jpg ./production/ 2>/dev/null || :
cp ./public-preview/*.svg ./production/ 2>/dev/null || :
cp ./public-preview/*.css ./production/ 2>/dev/null || :
cp ./public-preview/*.js ./production/ 2>/dev/null || :

# Copy the test script
cp ./test-script.js ./production/

# Remove console.log statements from production JS files (except test script)
echo "Optimizing JavaScript..."
if command -v sed &> /dev/null; then
    find ./production -name "*.js" -not -name "test-script.js" -exec sed -i '' 's/console\.log[^;]*;//g' {} \;
fi

# Create a basic web server configuration file
echo "Creating server configuration..."
cat > ./production/.htaccess << EOF
# Enable CORS for all resources
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type"

# Set proper MIME types
AddType application/javascript .js
AddType text/css .css
AddType image/png .png
AddType image/jpeg .jpg
AddType image/svg+xml .svg

# Set caching headers for static assets
<FilesMatch "\.(jpg|jpeg|png|gif|svg|js|css)$">
    Header set Cache-Control "max-age=604800, public"
</FilesMatch>

# Set caching for HTML files (shorter duration)
<FilesMatch "\.html$">
    Header set Cache-Control "max-age=3600, public"
</FilesMatch>

# Redirect to HTTPS (uncomment when deploying to a server with SSL)
# RewriteEngine On
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
EOF

echo "Production build complete. Files are in the ./production directory."
echo "To test locally: cd production && python -m http.server 8080"
