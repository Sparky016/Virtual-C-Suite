# CEO Chat API - Frontend Integration Guide

## Overview

The CEO Chat API provides an intelligent conversational interface where users can ask business questions and receive strategic advice from a virtual CEO. The unique feature is **Board Consultation**: the CEO autonomously decides when to consult domain experts (CFO, CMO, COO) to provide comprehensive, multi-perspective responses.

## Key Features

- **Autonomous Board Consultation**: AI determines which executives to consult based on question complexity
- **Multi-Domain Expertise**:
  - **CFO**: Financial analysis, cash flow, profitability, budgeting
  - **CMO**: Marketing strategy, customer acquisition, brand growth
  - **COO**: Operations, efficiency, process optimization, scalability
- **Conversation Memory**: Maintains context across multiple turns
- **Unified Response**: Single cohesive answer synthesizing all expert input
- **Performance Metrics**: Track consultation patterns and response times

## API Endpoint

### Base URL
```
Production: https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run
```

### Endpoint
```
POST /api/ceo-chat
```

## Request Format

### Headers
```http
Content-Type: application/json
```

### Request Body
```typescript
interface CEOChatRequest {
  messages: Message[];      // Required: Conversation history
  userId?: string;          // Optional: User identifier (default: 'anonymous')
  requestId?: string;       // Optional: Request ID (auto-generated if not provided)
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

### Example Request
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Should I increase my marketing budget or focus on improving profit margins?"
    }
  ],
  "userId": "user-12345"
}
```

### Multi-Turn Conversation
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I'm thinking about raising prices."
    },
    {
      "role": "assistant",
      "content": "Raising prices is a strategic decision that requires careful analysis..."
    },
    {
      "role": "user",
      "content": "What will this do to my cash flow?"
    }
  ],
  "userId": "user-12345"
}
```

## Response Format

```typescript
interface CEOChatResponse {
  success: boolean;
  reply: string;                          // CEO's response
  consultedExecutives: ('CFO' | 'CMO' | 'COO')[];  // Which board members were consulted
  metrics: {
    duration: number;                     // Total response time (ms)
    consultationDuration?: number;        // Time spent on consultations (ms)
    attempts: number;                     // Retry attempts
  };
}
```

### Example Success Response
```json
{
  "success": true,
  "reply": "Based on your question, I've consulted with my CFO and CMO. My CFO points out that improving profit margins should be your immediate priority because...",
  "consultedExecutives": ["CFO", "CMO"],
  "metrics": {
    "duration": 3274,
    "consultationDuration": 1127,
    "attempts": 1
  }
}
```

### Example Error Response
```json
{
  "error": "CEO chat failed",
  "message": "Detailed error message"
}
```

## Frontend Implementation Examples

### React/TypeScript Example

```typescript
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CEOChatResponse {
  success: boolean;
  reply: string;
  consultedExecutives: string[];
  metrics: {
    duration: number;
    consultationDuration?: number;
    attempts: number;
  };
}

export function useCEOChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (userMessage: string, userId: string) => {
    setLoading(true);
    setError(null);

    // Add user message to conversation
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];

    try {
      const response = await fetch('https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/api/ceo-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CEOChatResponse = await response.json();

      if (data.success) {
        // Add assistant response to conversation
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);

        return {
          reply: data.reply,
          consultedExecutives: data.consultedExecutives,
          metrics: data.metrics,
        };
      } else {
        throw new Error('CEO chat failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError(null);
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearConversation,
  };
}
```

### Usage in Component
```typescript
function CEOChatComponent() {
  const { messages, loading, error, sendMessage } = useCEOChat();
  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    try {
      const result = await sendMessage(input, 'user-12345');
      console.log('Consulted executives:', result.consultedExecutives);
      console.log('Response time:', result.metrics.duration, 'ms');
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="ceo-chat">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'CEO'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      {loading && <div className="loading">CEO is consulting the board...</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the CEO anything..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
```

### Vanilla JavaScript Example

```javascript
async function sendCEOMessage(messages, userId = 'anonymous') {
  try {
    const response = await fetch('https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/api/ceo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('CEO chat error:', error);
    throw error;
  }
}

// Usage
const messages = [
  { role: 'user', content: 'How can I improve my cash flow?' }
];

sendCEOMessage(messages, 'user-123')
  .then(response => {
    console.log('CEO Reply:', response.reply);
    console.log('Consulted:', response.consultedExecutives);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

## Understanding Board Consultations

### Consultation Decision Logic

The CEO automatically decides which executives to consult based on the question content:

| Domain | Triggers | Example Questions |
|--------|----------|-------------------|
| **CFO** | Budget, profitability, cash flow, financial risk, pricing, revenue, costs, margins | "Should I cut costs or invest in growth?" |
| **CMO** | Branding, customer acquisition, market growth, advertising, retention | "How can I grow my customer base?" |
| **COO** | Logistics, efficiency, personnel, process management, operations, scalability | "How do I streamline my operations?" |
| **None** | General leadership, strategy, vision, casual conversation | "What makes a good CEO?" |
| **Multiple** | Complex questions spanning domains | "Should I expand to a new market?" (CFO+CMO+COO) |

### Identifying Consultations in Response

The CEO's response will naturally incorporate board input:

```
"My CFO points out that..."
"From a marketing perspective, my CMO suggests..."
"On the operations side, my COO recommends..."
```

You can also check the `consultedExecutives` array to display badges or indicators in your UI.

## Best Practices

### 1. Handle Loading States
Consultations can take 2-5 seconds. Show clear loading indicators:
```typescript
{loading && (
  <div>
    CEO is consulting the board...
    {consultedExecutives.length > 0 && (
      <span>Talking to: {consultedExecutives.join(', ')}</span>
    )}
  </div>
)}
```

### 2. Display Consultation Metadata
Show users which executives were consulted to build trust:
```typescript
{response.consultedExecutives.length > 0 && (
  <div className="consultation-badge">
    ✓ Consulted with: {response.consultedExecutives.join(', ')}
  </div>
)}
```

### 3. Implement Retry Logic
```typescript
async function sendMessageWithRetry(messages: Message[], userId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessage(messages, userId);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### 4. Validate Input
```typescript
function validateMessage(content: string): boolean {
  if (!content.trim()) return false;
  if (content.length > 2000) return false; // Set reasonable limits
  return true;
}
```

### 5. Maintain Conversation Context
Always send the full conversation history for context-aware responses:
```typescript
// ✅ Good - Full context
const messages = [
  { role: 'user', content: 'I want to raise prices' },
  { role: 'assistant', content: '...' },
  { role: 'user', content: 'What about profit margins?' } // CEO has context
];

// ❌ Bad - No context
const messages = [
  { role: 'user', content: 'What about profit margins?' } // CEO doesn't know you were discussing pricing
];
```

### 6. Error Handling
```typescript
try {
  const response = await sendMessage(message, userId);
  // Handle success
} catch (error) {
  if (error.status === 400) {
    // Bad request - check input validation
  } else if (error.status === 500) {
    // Server error - retry or show error message
  } else {
    // Network error - check connectivity
  }
}
```

## Testing Examples

### Test Case 1: Financial Question
```bash
curl -X POST https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/api/ceo-chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "How can I improve my cash flow?"}
    ],
    "userId": "test-user"
  }'
```
**Expected:** `consultedExecutives: ["CFO"]`

### Test Case 2: Marketing Question
```bash
curl -X POST https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/api/ceo-chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "How do I grow my customer base?"}
    ],
    "userId": "test-user"
  }'
```
**Expected:** `consultedExecutives: ["CMO"]`

### Test Case 3: Multi-Domain Question
```bash
curl -X POST https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/api/ceo-chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Should I expand to a new market? I am worried about costs, operations, and marketing."}
    ],
    "userId": "test-user"
  }'
```
**Expected:** `consultedExecutives: ["CFO", "CMO", "COO"]`

### Test Case 4: General Question
```bash
curl -X POST https://svc-01kc60d8nn7denc1j21jhgpjy8.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/api/ceo-chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What makes a great leader?"}
    ],
    "userId": "test-user"
  }'
```
**Expected:** `consultedExecutives: []`

## Performance Considerations

### Response Times
- **No consultation**: ~1-2 seconds
- **Single executive**: ~2-3 seconds
- **Multiple executives**: ~3-5 seconds (parallel execution)

### Rate Limiting
- Implement client-side rate limiting to prevent abuse
- Consider debouncing user input

### Conversation Length
- Longer conversation histories increase processing time
- Consider limiting conversation history to last 10-20 messages for optimal performance
- Summarize older messages if needed

## UI/UX Recommendations

### 1. Loading Indicators
```typescript
<div className="ceo-thinking">
  <div className="spinner"></div>
  <p>CEO is analyzing your question...</p>
  {consultedExecutives.length > 0 && (
    <p className="consultation-note">
      Consulting with {consultedExecutives.join(' and ')}
    </p>
  )}
</div>
```

### 2. Executive Badges
```typescript
{response.consultedExecutives.includes('CFO') && (
  <span className="badge cfo">💼 CFO Input</span>
)}
{response.consultedExecutives.includes('CMO') && (
  <span className="badge cmo">📈 CMO Input</span>
)}
{response.consultedExecutives.includes('COO') && (
  <span className="badge coo">⚙️ COO Input</span>
)}
```

### 3. Suggested Questions
Provide quick-start examples:
```typescript
const suggestedQuestions = [
  "How can I improve my profit margins?",
  "What marketing strategy should I use to acquire more customers?",
  "How do I scale my operations efficiently?",
  "Should I raise prices or cut costs?"
];
```

### 4. Conversation Starters
Categorize by domain:
```typescript
const categories = {
  finance: ["Cash flow questions", "Profitability advice", "Budget planning"],
  marketing: ["Customer acquisition", "Brand strategy", "Market expansion"],
  operations: ["Process optimization", "Team efficiency", "Scalability"]
};
```

## Security Considerations

1. **Authentication**: Always pass a validated `userId` to track usage and prevent abuse
2. **Input Sanitization**: Sanitize user input before sending to API
3. **HTTPS Only**: Always use HTTPS in production
4. **API Key Management**: If authentication is added, store API keys securely (environment variables, not in code)
5. **Content Filtering**: Consider implementing client-side content filtering for inappropriate content

## Support & Troubleshooting

### Common Issues

**Issue: "messages array is required" error**
- Solution: Ensure you're sending a valid `messages` array with at least one message

**Issue: Slow responses**
- Likely consulting multiple executives (check `consultedExecutives` array)
- Expected behavior for complex questions

**Issue: Context not maintained**
- Ensure you're including full conversation history in each request
- Check that message roles alternate between 'user' and 'assistant'

**Issue: Empty `consultedExecutives` array**
- This is normal for general/strategic questions
- CEO responds directly without board consultation

### Getting Help

For issues or questions:
1. Check the console logs for detailed error messages
2. Verify request/response format matches documentation
3. Test with curl examples to isolate frontend vs. API issues
4. Contact backend team with request ID for debugging

## Changelog

### Version 1.0.0 (Current)
- Initial release with board consultation feature
- Support for CFO, CMO, COO consultations
- Conversation memory and context
- Performance metrics
- Error handling and fallbacks

---

**Last Updated**: 2025-12-11
**API Version**: 1.0.0
**Status**: Production Ready ✅
