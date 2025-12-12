# RAG (Retrieval Augmented Generation) System

## Overview

The Virtual C-Suite platform includes a Retrieval Augmented Generation (RAG) system that allows the CEO chat to reference uploaded documents for context. This feature is currently available when using **Vultr** as the inference provider.

## How It Works

### 1. Document Upload & Ingestion

When a user uploads a file for analysis:

1. **File Upload** (`/upload` endpoint)
   - User uploads a CSV, Excel, or other supported file
   - File is stored in the INPUT_BUCKET
   - Analysis request is created in the database

2. **Automatic Processing** (board-meeting-processor)
   - File is automatically processed when uploaded
   - Content is extracted from the file
   - **RAG Ingestion**: File content is added to the user's Vultr Vector Store collection
   - Executive analyses (CFO, CMO, COO) are generated
   - CEO synthesis report is created

3. **Vector Store Management** (AIOrchestrationService)
   - Creates a Vultr Vector Store collection for each user (on first upload)
   - Collection name format: `Raindrop-Context-{userId}`
   - Collection ID is saved to user settings in the database
   - Each document is added to the collection with its filename as metadata

### 2. CEO Chat with RAG Context

When a user interacts with the CEO chat:

1. **Request Processing**
   - User sends a message to the CEO chat
   - System checks if user has Vultr provider configured
   - System retrieves the user's RAG collection ID from settings

2. **Context Retrieval**
   - If collection ID exists, it's automatically included in the chat request
   - Vultr's RAG system retrieves relevant document excerpts based on the query
   - Retrieved context is used to augment the CEO's response

3. **Response Generation**
   - CEO generates a response informed by:
     - The user's question
     - Previous conversation history
     - Board member consultations (if needed)
     - **Uploaded document context from RAG**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Uploads File                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              board-meeting-processor                     │
│  1. Process file for analysis                           │
│  2. Extract text content                                │
│  3. Ingest into Vultr Vector Store ──────────┐          │
│  4. Generate executive analyses              │          │
└──────────────────────────────────────────────┼──────────┘
                                               │
                                               ▼
                      ┌────────────────────────────────────┐
                      │   Vultr Vector Store Collection    │
                      │   - Document chunks                │
                      │   - Embeddings                     │
                      │   - Metadata (filenames)           │
                      └────────┬───────────────────────────┘
                               │
                               │ Retrieved on chat
                               ▼
┌─────────────────────────────────────────────────────────┐
│                    CEO Chat Request                      │
│  1. User asks question                                   │
│  2. System includes collection ID                        │
│  3. Vultr RAG retrieves relevant context                │
│  4. CEO generates response with context                 │
└─────────────────────────────────────────────────────────┘
```

## Provider Support

| Provider   | RAG Support | Notes                                      |
|------------|-------------|--------------------------------------------|
| Vultr      | ✅ Yes      | Full RAG support with vector store         |
| SambaNova  | ❌ No       | No RAG capabilities                        |
| Cloudflare | ❌ No       | No RAG capabilities (uses Workers AI)      |

## User Experience

### For Vultr Users

1. **First Upload**:
   - System automatically creates a Vector Store collection
   - Collection ID is saved to user settings
   - Document is ingested and immediately available for CEO chat

2. **Subsequent Uploads**:
   - Documents are added to the existing collection
   - All uploaded documents become part of the CEO's context

3. **CEO Chat**:
   - CEO can reference any previously uploaded document
   - No additional configuration needed
   - Context is automatically retrieved based on relevance

### For Non-Vultr Users

- Documents are still processed for analysis (CFO, CMO, COO reports)
- CEO chat works normally but without document context
- Consider switching to Vultr to enable RAG features

## Implementation Details

### Key Files

1. **`src/services/AIOrchestrationService.ts`**
   - `ingestFileIntoVectorStore()`: Handles document ingestion
   - `runAI()`: Injects collection ID into chat requests
   - `executeCEOChatStream()`: Streams CEO responses with RAG context

2. **`src/board-meeting-processor/index.ts`**
   - Processes uploaded files
   - Calls RAG ingestion after file is read
   - Logs ingestion status

3. **`src/services/AI/VultrProvider.ts`**
   - `createVectorStore()`: Creates new collection
   - `addVectorStoreItem()`: Adds document to collection
   - `chat()`: Sends collection ID with chat requests

### Database Schema

User settings include RAG collection tracking:

```sql
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  inference_provider TEXT NOT NULL,
  vultr_api_key TEXT,
  sambanova_api_key TEXT,
  elevenlabs_api_key TEXT,
  vultr_rag_collection_id TEXT,  -- RAG collection ID
  updated_at INTEGER NOT NULL
);
```

## Logging & Debugging

RAG operations are logged with `[RAG]` prefix:

```
[RAG] Creating new Vultr Vector Store for user: {userId}
[RAG] Created collection: {collectionId}
[RAG] Saved collection ID to user settings
[RAG] Ingesting document into collection {collectionId}: {filename} ({size} chars)
[RAG] Successfully ingested {filename} - now available for CEO chat context
```

To troubleshoot RAG issues:
1. Check logs for `[RAG]` entries
2. Verify user has Vultr provider configured
3. Verify user settings include `vultr_rag_collection_id`
4. Check if collection exists in Vultr dashboard

## Benefits

1. **Contextual Responses**: CEO can reference specific data from uploaded documents
2. **Automatic**: No user configuration needed
3. **Persistent**: All uploaded documents remain available for future chats
4. **Relevant**: Only relevant document sections are retrieved for each query
5. **Scalable**: Can handle multiple documents across multiple uploads

## Future Enhancements

Potential improvements:

1. **Document Management**: Allow users to view/delete specific documents from collection
2. **Multi-Provider Support**: Extend RAG to SambaNova when supported
3. **Document Types**: Support PDF, Word docs, and other formats beyond plain text
4. **Metadata**: Add timestamps, tags, and categories to documents
5. **Search Interface**: Allow users to search their document collection directly
6. **Collection Limits**: Implement size limits and cleanup for old documents
