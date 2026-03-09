const express = require('express');
const Together = require('together-ai');
const TxtKnowledgeBase = require('../utils/knowledgeBase');
const ChatManager = require('../utils/chatManager');

const router = express.Router();

// Initialize Together AI
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
});

// Initialize knowledge base and chat manager
const kb = new TxtKnowledgeBase();
const chatManager = new ChatManager();

const getUserId = (req) => {
  return req.headers['x-user-id'] || req.query.userId || 'anonymous';
};


// Create new chat
router.post('/new', async (req, res) => {
  try {
    const { domainName } = req.body;
    const userId = getUserId(req);
    const newChat = await chatManager.createChat(domainName || 'General', null, userId);
    res.json(newChat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ 
      error: 'Failed to create new chat',
      details: error.message 
    });
  }
});

// Get all chats
router.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req)
    const chats = await chatManager.getUserChats(userId);
    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ 
      error: 'Failed to get chat history',
      details: error.message 
    });
  }
});

// Get specific chat
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = getUserId(req)
    const chat = await chatManager.getChat(chatId, userId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ 
      error: 'Failed to get chat',
      details: error.message 
    });
  }
});

// Delete chat
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = getUserId(req);

    const chat = await chatManager.getChatWithUserCheck(chatId, userId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const success = await chatManager.deleteChat(chatId);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete chat' });
    }
    
    // Only send ONE response
    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to delete chat',
        details: error.message 
      });
    }
  }
});

// Send message to chat
router.post('/:chatId/message', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get chat
    const chat = await chatManager.getChat(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message
    const userMessage = { role: 'user', content: message };
    await chatManager.addMessage(chatId, userMessage);

    // Load domain content
    const domainContent = await kb.loadDomainContent(chat.domainName);
    
    let systemMessage;
    let relevantFiles = [];

    if (!domainContent || Object.keys(domainContent).length === 0 || chat.domainName === 'General') {
      systemMessage = `You are an expert research assistant for ${chat.domainName}, working within the analytical framework of the American Enterprise Institute (AEI).
AEI INSTITUTIONAL CONTEXT:
The American Enterprise Institute (AEI) is a prominent Washington, D.C.–based conservative and free-market–oriented public policy think tank, founded in 1938. AEI’s mission is to defend the principles of individual liberty, free enterprise, limited government, and democratic capitalism, and to improve the institutions that uphold those values. It conducts rigorous, evidence-based research and analysis on a wide range of domestic and international policy issues, including economics, foreign policy, national security, health care, education, energy, and social welfare.

CRITICAL ACCURACY REQUIREMENTS:
- NEVER fabricate, invent, or guess at facts, statistics, dates, names, or events
- If you don't know something with certainty, explicitly state "I don't have reliable information about..." 
- Do not create fake citations, studies, or research that doesn't exist
- When uncertain, acknowledge limitations and suggest where reliable information might be found
- Distinguish clearly between established facts and analytical interpretations
- If asked about recent events or data you're unsure about, state your knowledge limitations

VERIFICATION STANDARDS:
- Only present information you can verify or that comes from established, credible sources
- When making claims, indicate the level of certainty (e.g., "Research generally shows..." vs "It's definitively established that...")
- Acknowledge when topics are disputed or when there are legitimate disagreements among experts
- If you cannot provide a factual answer, offer to help the user find authoritative sources instead

YOUR ROLE FOR ${chat.domainName.toUpperCase()}:
Provide expert analysis and insights on ${chat.domainName} topics, informed by AEI's commitment to:
- Rigorous, evidence-based research methodology
- Free market principles and limited government solutions
- Individual liberty and institutional strength
- Practical policy applications and real-world implications
- Conservative analytical perspective with scholarly objectivity

Since no specific knowledge files are available for ${chat.domainName}, draw upon established research, empirical evidence, and sound analytical frameworks. Maintain AEI's standard of intellectual rigor while making complex topics accessible to policymakers, researchers, and informed citizens.

RESPONSE PROTOCOL WHEN UNCERTAIN:
- State clearly: "I don't have reliable information to confirm..."
- Suggest: "For accurate information on this topic, I'd recommend consulting..."
- Offer: "I can help you think through the analytical framework, but you'll need to verify the specific facts..."

When addressing ${chat.domainName} issues, consider market-based solutions, institutional factors, and policy trade-offs consistent with AEI's research approach.`;
    } else {
      // Search for relevant content
      const searchResults = kb.searchContent(domainContent, message, 3);
      
      systemMessage = `You are an expert research assistant for ${chat.domainName}, operating within the American Enterprise Institute's analytical framework.

ABSOLUTE ACCURACY REQUIREMENTS:
- NEVER fabricate facts, statistics, quotes, or information not present in the provided sources
- NEVER create fake citations, studies, researchers, or publications
- If information isn't in the knowledge base, explicitly state this limitation
- Do not extrapolate beyond what the sources actually contain
- When sources are incomplete or unclear, acknowledge these limitations
- Distinguish between what sources explicitly state vs. your analytical interpretation

DOMAIN EXPERTISE: ${chat.domainName.toUpperCase()}
You are the go-to expert for all ${chat.domainName}-related inquiries, providing analysis informed by AEI's research standards and conservative policy perspective.

AEI ANALYTICAL FRAMEWORK:
- Evidence-based research with rigorous methodology
- Free market economics and limited government principles
- Strong institutions and rule of law
- Individual responsibility and liberty
- Practical policy solutions with real-world applications
- Historical context and comparative analysis

RESPONSE STANDARDS:
- Provide ${chat.domainName} expertise backed ONLY by verifiable data and evidence
- Apply conservative analytical lens while maintaining scholarly objectivity and factual precision
- Consider policy implications specific to ${chat.domainName} issues based on reliable sources
- Reference only verified research and empirical findings
- When sources are insufficient, clearly state: "The available sources don't provide enough information to..."
- Acknowledge complexity while offering clear frameworks based on verified information`;

      if (searchResults.length > 0) {
        systemMessage += `\n\nRELEVANT ${chat.domainName.toUpperCase()} KNOWLEDGE BASE:\n`;
        
        searchResults.forEach((result, i) => {
          systemMessage += `\n=== SOURCE ${i + 1}: ${result.filename} ===\n${result.content}\n`;
          relevantFiles.push(result.filename);
        });

        systemMessage += `\n\nSOURCE UTILIZATION GUIDELINES:
- Synthesize the provided ${chat.domainName} content with broader research and AEI's analytical approach
- Cite specific sources when referencing data, findings, or key arguments
- Connect source material to wider ${chat.domainName} policy implications
- If sources present conflicting information, provide reasoned analysis
- Identify areas where additional ${chat.domainName} research might be valuable
- Ensure responses reflect both domain expertise and AEI's research standards

WHEN SOURCES ARE INSUFFICIENT:
- Acknowledge the limitation clearly
- Describe what information IS available in the sources
- Suggest what additional sources or research might be needed
- Offer to help with related questions that the sources can address

Deliver comprehensive ${chat.domainName} analysis that serves policymakers, researchers, and stakeholders with AEI's commitment to intellectual excellence.`;
      }
    }

    // Get chat messages for context
    const chatMessages = await chatManager.getChat(chatId);
    const contextMessages = chatMessages.messages.slice(-10); // Last 10 messages for context

    // Create full messages array
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...contextMessages
    ];

    // Get AI response
    const response = await together.chat.completions.create({
      model: 'meta-llama/Llama-3-70b-chat-hf', // meta-llama/Llama-3-8b-chat-hf meta-llama/Llama-3-70b-chat-hf meta-llama/Meta-Llama-3-8B-Instruct-Lite
      messages: fullMessages,
      max_tokens: 512,
      temperature: 0.7,
      stream: false
    });

    const aiResponse = {
      role: 'assistant',
      content: response.choices[0].message.content,
      sources: relevantFiles,
      searchMode: Object.keys(domainContent).length === 0 ? 'general' : 'knowledge_base'
    };

    // Add AI message to chat
    await chatManager.addMessage(chatId, aiResponse);

    // Update chat title if it's the first message
    if (chatMessages.messages.length <= 1) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await chatManager.updateChatTitle(chatId, title);
    }

    res.json({
      response: aiResponse.content,
      sources: relevantFiles,
      searchMode: aiResponse.searchMode,
      chatId: chatId
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// Legacy endpoint for backward compatibility
router.post('/', async (req, res) => {
  try {
    const { messages, domainName, userQuery } = req.body;

    if (!messages || !domainName || !userQuery) {
      return res.status(400).json({ 
        error: 'Missing required fields: messages, domainName, userQuery' 
      });
    }

    // Create a new chat if none exists
    const newChat = await chatManager.createChat(domainName);
    
    // Add messages to the new chat
    for (const message of messages) {
      await chatManager.addMessage(newChat.id, message);
    }

    // Process the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === 'user') {
      // Redirect to the new message endpoint
      req.params.chatId = newChat.id;
      req.body.message = lastUserMessage.content;
      return router._router.stack.find(layer => 
        layer.route && layer.route.path === '/:chatId/message' && layer.route.methods.post
      ).route.stack[0].handle(req, res);
    }

    res.json({ chatId: newChat.id });

  } catch (error) {
    console.error('Legacy chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

module.exports = router;