const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// Function to fetch widget configuration from ElevenLabs API
exports.getWidgetConfig = functions.https.onRequest({
  cors: {
    origin: true,  // Allows all origins, same as ['*'] but with proper header handling
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400  // 24 hours in seconds
  },
  maxInstances: 10
}, async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Get the agent ID from query parameters
    const agentId = req.query.agentId;
    
    if (!agentId) {
      console.error('Missing agent ID in request');
      res.status(400).json({ 
        error: 'Agent ID is required',
        message: 'The request is missing the required agentId parameter.'
      });
      return;
    }
    
    // Use process.env instead of functions.config()
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ElevenLabs API key not configured');
      res.status(500).json({ 
        error: 'API configuration error', 
        message: 'The ElevenLabs API key is missing. Please check your Firebase environment variables.'
      });
      return;
    }
    
    // Log that we found the API key (without revealing it)
    console.log('ElevenLabs API key found and properly configured');
    
    // Fetch widget configuration from ElevenLabs API
    const widgetUrl = `https://api.elevenlabs.io/v1/convai/agents/${agentId}/widget`;
    console.log(`Fetching widget configuration from: ${widgetUrl}`);
    
    const widgetResponse = await fetch(widgetUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!widgetResponse.ok) {
      const errorText = await widgetResponse.text();
      console.error('Error fetching widget configuration:', {
        status: widgetResponse.status,
        statusText: widgetResponse.statusText,
        error: errorText
      });
      
      res.status(widgetResponse.status).json({
        error: `Error fetching widget configuration: ${widgetResponse.statusText}`,
        details: errorText
      });
      return;
    }
    
    // Parse and return the widget configuration
    const widgetData = await widgetResponse.json();
    console.log('Successfully retrieved widget configuration');
    res.status(200).json(widgetData);
    
  } catch (error) {
    console.error('Unexpected error in getWidgetConfig:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Function to proxy the ElevenLabs widget script
exports.getWidgetScript = functions.https.onRequest({
  cors: {
    origin: true, // Allows all origins
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400 // Cache CORS preflight for 24 hours
  },
  maxInstances: 10
}, async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // URL of the actual widget script on the CDN
  // IMPORTANT: Verify this URL is still correct. If ElevenLabs changed it, update this.
  const widgetScriptUrl = 'https://elevenlabs.io/convai-widget/index.js'; // Use the direct URL that worked

  try {
    console.log(`Proxying request for widget script: ${widgetScriptUrl}`);
    const response = await fetch(widgetScriptUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching widget script from CDN: ${response.status} ${response.statusText}`, errorText);
      res.status(response.status).send(`Failed to fetch widget script: ${response.statusText}`);
      return;
    }

    const scriptContent = await response.text();

    // Set the correct content type for JavaScript
    res.set('Content-Type', 'text/javascript; charset=utf-8');
    // Optionally, set cache control headers if desired
    // res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    console.log('Successfully fetched and sending widget script.');
    res.status(200).send(scriptContent);

  } catch (error) {
    console.error('Error in getWidgetScript proxy function:', error);
    res.status(500).send('Internal server error while fetching widget script.');
  }
});

exports.getConversationDetails = functions.https.onRequest({
  cors: {
    origin: true,  // Allows all origins, same as ['*'] but with proper header handling
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400  // 24 hours in seconds
  },
  maxInstances: 10
}, async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    // Log incoming request
    console.log('Request body:', req.body);
    
    // Use process.env instead of functions.config()
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ElevenLabs API key not configured');
      res.status(500).json({ 
        error: 'API configuration error', 
        message: 'The ElevenLabs API key is missing. Please check your Firebase environment variables.'
      });
      return;
    }
    
    // Log that we found the API key (without revealing it)
    console.log('ElevenLabs API key found and properly configured');

    const agentId = req.body?.data?.agentId;
    if (!agentId) {
      console.error('Missing agent ID in request');
      res.status(400).json({ 
        error: 'Agent ID is required',
        message: 'The request is missing the required agentId parameter.'
      });
      return;
    }
    
    // Get user ID from request (for privacy protection)
    const userId = req.body?.data?.userId;
    if (userId) {
      console.log(`Processing request for agent ID: ${agentId} and user ID: ${userId}`);
    } else {
      console.log(`Processing request for agent ID: ${agentId} (no user ID provided - privacy concern)`);
    }

    // Check if we need to fetch multiple conversations
    const fetchMultiple = req.body?.data?.fetchMultiple || false;
    const limit = req.body?.data?.limit || 3; // Default to 3 if not specified
    
    console.log(`Request type: ${fetchMultiple ? 'Multiple conversations' : 'Single conversation'}, limit: ${limit}`);

    // Get conversation ID from request - this could be an actual conversation ID
    // or we might need to find the latest conversation(s)
    let conversationId = req.body?.data?.conversationId || req.body?.data?.sessionId || null;
    
    // Sanitize the conversation ID to remove invalid characters
    if (conversationId) {
      // Store original for logging
      const originalId = conversationId;
      
      // Remove any non-alphanumeric characters except dashes and underscores
      // This is a conservative approach to ensure a valid URL path component
      conversationId = conversationId.replace(/[^a-zA-Z0-9-_]/g, '');
      
      // Log the sanitization results
      if (originalId !== conversationId) {
        console.log(`Sanitized conversation ID from '${originalId}' to '${conversationId}'`);
      } else {
        console.log(`Received conversation ID from request: ${conversationId}`);
      }
    } else {
      console.log('No conversation ID provided in the request, will attempt to find the most recent one(s)');
    }
    
    console.log(`Looking up conversation(s) for agent: ${agentId}`);
    
    // Fetch recent conversations (needed for both single and multiple conversation scenarios)
    console.log(`Fetching up to ${limit} recent conversations`);
    
    // Get recent conversations
    const pageSize = fetchMultiple ? limit : 10; // If fetching multiple, use the limit, otherwise fetch more to filter
    const conversationsUrl = `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agentId}&page_size=${pageSize}`;
    const conversationsResponse = await fetch(conversationsUrl, {
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!conversationsResponse.ok) {
      const errorText = await conversationsResponse.text();
      console.error('ElevenLabs API error:', {
        status: conversationsResponse.status,
        statusText: conversationsResponse.statusText,
        body: errorText
      });
      res.status(502).json({ 
        error: 'Error from ElevenLabs API',
        details: {
          status: conversationsResponse.status,
          message: errorText
        }
      });
      return;
    }

    const conversationsData = await conversationsResponse.json();
    console.log('Found conversations:', JSON.stringify(conversationsData));

    if (!conversationsData.conversations?.length) {
      console.log('No conversations found for agent');
      res.status(404).json({ error: 'No conversations found' });
      return;
    }

    // If userId is provided, filter for conversations belonging to this user only
    // This is critical for privacy protection
    let userConversations = conversationsData.conversations;
    
    if (userId) {
      console.log(`Filtering conversations for user ID: ${userId}`);
      
      // Filter conversations by checking metadata for user_id
      const filteredConversations = conversationsData.conversations.filter(convo => {
        // Check dynamic variables in metadata
        if (convo.metadata && convo.metadata.dynamic_variables) {
          try {
            // Try parsing as JSON if it's a string
            const dynamicVars = typeof convo.metadata.dynamic_variables === 'string' 
              ? JSON.parse(convo.metadata.dynamic_variables)
              : convo.metadata.dynamic_variables;
              
            // Check if the conversation belongs to this user
            return dynamicVars.user_id === userId;
          } catch (e) {
            console.error('Error parsing dynamic variables:', e);
            return false;
          }
        }
        return false;
      });
      
      console.log(`Found ${filteredConversations.length} conversations for this user out of ${conversationsData.conversations.length} total`);
      
      // Only use filtered conversations if we found any
      if (filteredConversations.length > 0) {
        userConversations = filteredConversations;
      } else {
        console.warn(`No conversations found for user ID: ${userId}, falling back to all conversations - PRIVACY CONCERN`);
      }
    }
    
    // Sort conversations by time (newest first)
    userConversations.sort((a, b) => b.start_time_unix_secs - a.start_time_unix_secs);
    
    // Limit to requested number for multiple fetches
    if (fetchMultiple) {
      userConversations = userConversations.slice(0, limit);
      console.log(`Selected ${userConversations.length} most recent conversations for the user`);
      
      // For multiple conversations, we'll fetch each one's details and return them all
      const conversationsToProcess = userConversations;
      
      // Return the list immediately if we're just listing conversations
      if (req.body?.data?.listOnly) {
        console.log('Returning conversation list only, without details');
        res.json({ 
          data: { 
            conversations: conversationsToProcess 
          } 
        });
        return;
      }
      
      // Process each conversation to get details (will be continued below)
      console.log(`Fetching details for ${conversationsToProcess.length} conversations`);
      
      // The rest of the multiple conversation processing will be added below
      // For now, set conversationId to null so we don't process a single conversation
      conversationId = null;
      
      // We'll fetch details for each conversation in the next section
      return processMultipleConversations(conversationsToProcess);
    } else if (!conversationId) {
      // For single conversation mode without a specific ID, find the most recent one
      let mostRecentConversation = userConversations[0];
      
      console.log('Most recent conversation:', JSON.stringify(mostRecentConversation));
      
      conversationId = mostRecentConversation.conversation_id;
      console.log(`Found most recent conversation ID: ${conversationId}`);
    }
    
    // Function to process multiple conversations
    async function processMultipleConversations(conversations) {
      console.log(`Processing ${conversations.length} conversations`);
      
      // Set up an array to hold the transformed data for each conversation
      const transformedConversations = [];
      
      // Process each conversation (sequentially to avoid rate limits)
      for (const conversation of conversations) {
        try {
          console.log(`Fetching details for conversation: ${conversation.conversation_id}`);
          
          // Create a timeout for the fetch operation - 20 seconds per conversation
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);
          
          const detailsResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${conversation.conversation_id}`,
            {
              headers: {
                'xi-api-key': apiKey,
                'Accept': 'application/json'
              },
              signal: controller.signal
            }
          );
          
          // Clear timeout since fetch completed
          clearTimeout(timeoutId);
          
          if (!detailsResponse.ok) {
            console.error(`Error fetching details for conversation ${conversation.conversation_id}:`, {
              status: detailsResponse.status,
              statusText: detailsResponse.statusText
            });
            
            // Add a placeholder with basic info if we couldn't fetch details
            transformedConversations.push({
              conversation_id: conversation.conversation_id,
              agent_id: conversation.agent_id,
              status: 'error',
              error: `Failed to fetch details: ${detailsResponse.status} ${detailsResponse.statusText}`,
              created_at: conversation.start_time_unix_secs 
                ? new Date(conversation.start_time_unix_secs * 1000).toISOString() 
                : new Date().toISOString(),
              timestamp: new Date().toISOString()
            });
            
            continue; // Skip to next conversation
          }
          
          // Get the raw conversation details from ElevenLabs
          const rawDetails = await detailsResponse.json();
          console.log(`Successfully retrieved details for conversation: ${conversation.conversation_id}`);
          
          // Transform the data (same as in single conversation processing)
          const transformedData = {
            conversation_id: rawDetails.conversation_id,
            agent_id: rawDetails.agent_id,
            status: rawDetails.status,
            created_at: rawDetails.metadata?.start_time_unix_secs 
              ? new Date(rawDetails.metadata.start_time_unix_secs * 1000).toISOString() 
              : new Date().toISOString(),
            messages: (rawDetails.transcript || []).map(item => ({
              role: item.role,
              content: item.message,
              time: item.time_in_call_secs
            })),
            analysis: rawDetails.analysis ? {
              ...rawDetails.analysis,
              evaluation_criteria_results: rawDetails.evaluation_criteria_results || rawDetails.analysis.evaluation_criteria_results || {}
            } : null,
            metadata: rawDetails.metadata || {},
            timestamp: new Date().toISOString()
          };
          
          transformedConversations.push(transformedData);
          
        } catch (error) {
          console.error(`Error processing conversation ${conversation.conversation_id}:`, error);
          
          // Add a placeholder with error info
          transformedConversations.push({
            conversation_id: conversation.conversation_id,
            agent_id: conversation.agent_id,
            status: 'error',
            error: `Internal error: ${error.message}`,
            created_at: conversation.start_time_unix_secs 
              ? new Date(conversation.start_time_unix_secs * 1000).toISOString() 
              : new Date().toISOString(),
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Return all the transformed conversations
      console.log(`Returning ${transformedConversations.length} conversations`);
      res.json({ 
        data: { 
          conversations: transformedConversations 
        } 
      });
    }
    
    // If we're in multiple conversations mode, the function would have returned already
    // Continue with single conversation processing if we have a conversation ID
    if (!conversationId && fetchMultiple) {
      return; // The multiple conversations function would have sent the response already
    }
    
    // Now get the specific conversation details using the direct endpoint
    console.log(`Fetching details for conversation: ${conversationId}`);
    
    // Implement retry mechanism with exponential backoff for API calls
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let detailsResponse;
    
    while (retryCount <= MAX_RETRIES) {
      try {
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1}: Fetching conversation details`);
        
        // Create a timeout for the fetch operation - 45 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        
        try {
          detailsResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
            {
              headers: {
                'xi-api-key': apiKey,
                'Accept': 'application/json'
              },
              signal: controller.signal
            }
          );
          
          // Clear timeout since fetch completed
          clearTimeout(timeoutId);
          
          // If successful, break out of retry loop
          if (detailsResponse.ok) {
            console.log('Successfully retrieved conversation details');
            break;
          }
          
          // Check if this is a retryable error
          const isRetryableStatus = [
            408, // Request Timeout
            429, // Too Many Requests
            500, // Internal Server Error
            502, // Bad Gateway
            503, // Service Unavailable
            504  // Gateway Timeout
          ].includes(detailsResponse.status);
          
          if (isRetryableStatus && retryCount < MAX_RETRIES) {
            const errorText = await detailsResponse.text();
            console.warn(`Retryable error (${detailsResponse.status}): ${errorText}`);
            
            // Increment retry counter
            retryCount++;
            
            // Calculate delay with exponential backoff and jitter
            const baseDelay = Math.pow(2, retryCount) * 1000; // 2^retry * 1000ms
            const jitter = baseDelay * (0.5 + Math.random() * 0.5); // 50-100% of base delay
            
            console.log(`Retrying in ${Math.round(jitter)}ms... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, jitter));
            continue;
          } else {
            // Non-retryable error or max retries reached
            break;
          }
        } catch (fetchError) {
          // Clear timeout
          clearTimeout(timeoutId);
          
          // Handle timeout and network errors
          if (fetchError.name === 'AbortError') {
            console.warn(`Request timed out after 45 seconds`);
          }
          
          // Check if this is a network error we should retry
          const isNetworkError = (
            fetchError.name === 'TypeError' || // Network error
            fetchError.message.includes('network') || // Network error
            fetchError.message.includes('failed to fetch') || // General fetch failure
            fetchError.message.includes('NetworkError') || // Network error
            fetchError.message.includes('ChunkedEncodingError') || // Stream error
            fetchError.message.includes('ProtocolError') || // HTTP protocol error
            fetchError.message.includes('prematurely') // Premature connection closure
          );
          
          if (isNetworkError && retryCount < MAX_RETRIES) {
            console.warn(`Network error: ${fetchError.message}`);
            
            // Increment retry counter
            retryCount++;
            
            // Calculate delay with exponential backoff and jitter
            const baseDelay = Math.pow(2, retryCount) * 1000;
            const jitter = baseDelay * (0.5 + Math.random() * 0.5);
            
            console.log(`Retrying in ${Math.round(jitter)}ms... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, jitter));
            continue;
          }
          
          // Rethrow if not retrying
          throw fetchError;
        }
      } catch (error) {
        console.error(`Error on attempt ${retryCount + 1}:`, error);
        
        // If this is the last retry, set a 502 response to be consistent
        if (retryCount >= MAX_RETRIES) {
          // Create a simple Response object that mimics a failed fetch
          detailsResponse = {
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            text: async () => JSON.stringify({
              error: `Failed after ${MAX_RETRIES + 1} attempts: ${error.message}`
            })
          };
          break;
        }
        
        // Otherwise increment the retry counter (already done in inner loops)
        // and continue the retry loop
      }
    }

    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      console.error('Error fetching conversation details:', {
        status: detailsResponse.status,
        statusText: detailsResponse.statusText,
        body: errorText,
        conversationId: conversationId,
        url: `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`
      });
      
      let errorMessage = 'Unable to retrieve conversation details';
      
      // Provide more specific error messages based on status code
      if (detailsResponse.status === 404) {
        errorMessage = `Conversation with ID ${conversationId} not found. The conversation may have been deleted or not yet created.`;
      } else if (detailsResponse.status === 401 || detailsResponse.status === 403) {
        errorMessage = 'Authentication error with ElevenLabs API. Please check that your API key is valid and has sufficient permissions.';
      } else if (detailsResponse.status === 429) {
        errorMessage = 'Rate limit exceeded for ElevenLabs API. Please try again later.';
      } else {
        errorMessage = `ElevenLabs API error (${detailsResponse.status}): ${errorText || detailsResponse.statusText}`;
      }
      
      res.status(502).json({ 
        error: 'Error fetching conversation details from ElevenLabs',
        message: errorMessage,
        details: {
          status: detailsResponse.status,
          statusText: detailsResponse.statusText,
          conversationId: conversationId
        }
      });
      return;
    }

    // Get the raw conversation details from ElevenLabs
    const rawDetails = await detailsResponse.json();
    
    console.log('Successfully retrieved conversation details from ElevenLabs');
    
    // Transform the ElevenLabs response to match the format expected by the frontend
    const transformedData = {
      // Pass through common fields
      conversation_id: rawDetails.conversation_id,
      agent_id: rawDetails.agent_id,
      status: rawDetails.status,
      
      // Add timestamp for created_at
      created_at: rawDetails.metadata?.start_time_unix_secs 
        ? new Date(rawDetails.metadata.start_time_unix_secs * 1000).toISOString() 
        : new Date().toISOString(),
      
      // Transform transcript to messages format expected by frontend
      messages: (rawDetails.transcript || []).map(item => ({
        role: item.role,
        content: item.message,
        time: item.time_in_call_secs
      })),
      
      // Add any analysis data if available (ensure evaluation results are included in analysis object)
      analysis: rawDetails.analysis ? {
        ...rawDetails.analysis,
        // Ensure evaluation_criteria_results is in the analysis object
        evaluation_criteria_results: rawDetails.evaluation_criteria_results || rawDetails.analysis.evaluation_criteria_results || {}
      } : null,
      
      // Store original metadata
      metadata: rawDetails.metadata || {},
      
      // Timestamp when we retrieved this
      timestamp: new Date().toISOString()
    };
    
    // Log the structure we're sending to the frontend
    console.log('Transformed data structure:', {
      conversation_id: transformedData.conversation_id,
      message_count: transformedData.messages?.length || 0,
      has_analysis: !!transformedData.analysis,
      created_at: transformedData.created_at
    });
    
    // Return the transformed data to the frontend
    res.json({ data: transformedData });
    
  } catch (error) {
    console.error('Unexpected error in getConversationDetails:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Function to fetch and serve the ElevenLabs widget script with appropriate CORS headers
exports.getWidgetScript = functions.https.onRequest({
  cors: {
    origin: true,  // Allows all origins
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400  // 24 hours in seconds
  },
  maxInstances: 10
}, async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Fetch widget script from ElevenLabs
    console.log('Fetching ElevenLabs widget script');
    const scriptUrl = 'https://elevenlabs.io/convai-widget/index.js';
    
    const scriptResponse = await fetch(scriptUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/javascript'
      }
    });
    
    if (!scriptResponse.ok) {
      const errorText = await scriptResponse.text();
      console.error('Error fetching widget script:', {
        status: scriptResponse.status,
        statusText: scriptResponse.statusText,
        error: errorText
      });
      
      res.status(scriptResponse.status).json({
        error: `Error fetching widget script: ${scriptResponse.statusText}`,
        details: errorText
      });
      return;
    }
    
    // Get the script content
    const scriptContent = await scriptResponse.text();
    console.log('Successfully retrieved widget script');
    
    // Serve the script with proper Content-Type header
    res.set('Content-Type', 'application/javascript');
    res.status(200).send(scriptContent);
    
  } catch (error) {
    console.error('Unexpected error in getWidgetScript:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});