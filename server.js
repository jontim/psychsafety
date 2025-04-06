const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = 3000;
const DIRECTORY = './public'; // Change this to './public' to test the production version

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// Create the server
const server = http.createServer((req, res) => {
  console.log(`${req.method} request received for: ${req.url}`);
  
  // Parse the URL and get the pathname
  let filePath = path.join(__dirname, DIRECTORY, req.url);
  
  // If the URL ends with a '/', serve the index.html file
  if (filePath.endsWith('/')) {
    filePath += 'index.html';
  }
  
  // Get the file extension
  const extname = path.extname(filePath);
  
  // Set the content type based on the file extension
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read the file and send the response
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        console.log(`File not found: ${filePath}`);
        
        // Try to serve the 404 page if it exists
        fs.readFile(`./${DIRECTORY}/404.html`, (err, content) => {
          if (err) {
            // No 404 page found
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404 Not Found');
          } else {
            // Serve the 404 page
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        // Server error
        console.error(`Server error: ${error.code}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`500 Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving files from the '${DIRECTORY}' directory`);
  console.log('Press Ctrl+C to stop the server');
});
