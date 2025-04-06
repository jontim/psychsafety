/**
 * SPA Navigation Utilities for the Coaching Practice Application
 * Handles clean URLs and navigation without page reloads
 */

// Convert relative URLs to clean URLs
document.addEventListener('DOMContentLoaded', function() {
  // Update links to use clean URLs on platforms that support it
  const links = document.querySelectorAll('a[href$=".html"]');
  links.forEach(link => {
    // Only modify internal links
    if (link.host === window.location.host) {
      // Convert coaching-landing.html to coaching-landing, etc.
      link.href = link.href.replace(/\.html$/, '');
    }
  });

  // Handle link clicks
  document.body.addEventListener('click', function(event) {
    const link = event.target.closest('a');
    
    // Skip if not a link or it's an external link or has a target attribute
    if (!link || link.host !== window.location.host || link.target || link.getAttribute('data-spa-ignore')) {
      return;
    }
    
    // We're handling this link, prevent default navigation
    event.preventDefault();
    
    // Get the URL
    const url = link.href;
    
    // Push the new state
    history.pushState(null, '', url);
    
    // Handle the navigation
    handleNavigation(url);
  });
});

// Handle browser back/forward
window.addEventListener('popstate', function(event) {
  handleNavigation(window.location.href);
});

// Function to handle navigation
function handleNavigation(url) {
  // Extract the path from the URL
  const path = new URL(url).pathname;
  
  // Determine which page to load
  let page;
  
  if (path === '/' || path === '/index' || path === '/index.html') {
    page = 'index.html';
  } else if (path === '/coaching-landing' || path === '/coaching-landing.html') {
    page = 'coaching-landing.html';
  } else if (path === '/coach-selection' || path === '/coach-selection.html') {
    page = 'coach-selection.html';
  } else if (path === '/coach-profile' || path === '/coach-profile.html' || path === '/coach-profile-fixed' || path === '/coach-profile-fixed.html') {
    page = 'coach-profile-fixed.html';
  } else if (path === '/practice-coaching' || path === '/practice-coaching.html') {
    page = 'practice-coaching.html';
  } else if (path === '/scenarios' || path === '/scenarios.html') {
    page = 'scenarios.html';
  } else {
    // Default to index if not found
    page = 'index.html';
  }
  
  // Load the page
  fetch(page)
    .then(response => response.text())
    .then(html => {
      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Update the title
      document.title = doc.title;
      
      // Update the content
      const content = doc.querySelector('#main-content');
      if (content) {
        document.querySelector('#main-content').innerHTML = content.innerHTML;
      }
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Initialize any page-specific scripts
      const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
      scripts.forEach(script => {
        if (script.textContent.trim()) {
          try {
            eval(script.textContent);
          } catch (e) {
            console.error('Error executing script:', e);
          }
        }
      });
    })
    .catch(error => {
      console.error('Error loading page:', error);
    });
}
