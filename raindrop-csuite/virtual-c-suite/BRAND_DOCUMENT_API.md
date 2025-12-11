# Brand Document API Integration Guide

**For Frontend Developers**

This guide explains how to integrate with the Brand Document API to allow users to upload, manage, and utilize brand documents that provide context to the CEO chat feature.

---

## Table of Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Integration Flow](#integration-flow)
- [Code Examples](#code-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The Brand Document API allows users to upload documents (PDF, CSV, TXT) that describe their business, brand guidelines, values, and mission. The CEO chat automatically uses this context to provide brand-aligned recommendations.

### Key Features

- **Single Active Document**: Each user can have one active brand document at a time
- **Automatic Replacement**: Uploading a new document automatically replaces the previous one
- **Automatic CEO Integration**: The CEO chat automatically includes brand context in all responses
- **File Validation**: Maximum 10MB, supports PDF, CSV, and TXT files

### Base URL

```
Production: https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run
```

---

## API Endpoints

### 1. Upload Brand Document

Upload or replace a user's brand document.

**Endpoint:** `POST /brand-document`

**Content-Type:** `multipart/form-data`

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | The brand document file (PDF, CSV, or TXT, max 10MB) |
| `userId` | string | Yes | The unique identifier for the user |

**Response (201 Created):**

```json
{
  "success": true,
  "documentId": 123,
  "documentKey": "brand-documents/user-123/active-brand-document.pdf",
  "message": "Brand document uploaded successfully"
}
```

**Error Response (400 Bad Request):**

```json
{
  "error": "No file provided"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to upload brand document",
  "message": "Detailed error message"
}
```

---

### 2. Get Active Brand Document

Retrieve information about a user's active brand document.

**Endpoint:** `GET /brand-document?userId={userId}`

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | The unique identifier for the user (query parameter) |

**Response (200 OK) - Document Exists:**

```json
{
  "document": {
    "id": 123,
    "originalFilename": "brand-guidelines.pdf",
    "fileSize": 1048576,
    "contentType": "application/pdf",
    "createdAt": "2025-12-11T10:30:00.000Z"
  }
}
```

**Response (200 OK) - No Document:**

```json
{
  "document": null,
  "message": "No active brand document found"
}
```

**Error Response (400 Bad Request):**

```json
{
  "error": "userId query parameter required"
}
```

---

### 3. Delete Brand Document

Delete a user's brand document.

**Endpoint:** `DELETE /brand-document/:documentId?userId={userId}`

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | number | Yes | The ID of the document to delete (path parameter) |
| `userId` | string | Yes | The unique identifier for the user (query parameter) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Brand document deleted successfully"
}
```

**Error Response (404 Not Found):**

```json
{
  "error": "Brand document not found"
}
```

**Error Response (400 Bad Request):**

```json
{
  "error": "userId query parameter required"
}
```

---

### 4. Health Check

Check if the brand API is running.

**Endpoint:** `GET /health`

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-12-11T10:30:00.000Z"
}
```

---

## Integration Flow

### Typical User Journey

```
1. User navigates to Brand Settings page
   ↓
2. Frontend calls GET /brand-document to check for existing document
   ↓
3. If document exists, display document info with "Replace" and "Delete" options
   If no document, display "Upload" form
   ↓
4. User uploads/replaces document via POST /brand-document
   ↓
5. Frontend confirms upload success and updates UI
   ↓
6. User chats with CEO - brand context is automatically included
```

### State Management Recommendations

```typescript
interface BrandDocument {
  id: number;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
}

interface BrandDocumentState {
  document: BrandDocument | null;
  isLoading: boolean;
  error: string | null;
}
```

---

## Code Examples

### React Example with TypeScript

```typescript
import { useState, useEffect } from 'react';

const BRAND_API_URL = 'https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run';

interface BrandDocument {
  id: number;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
}

export function BrandDocumentManager({ userId }: { userId: string }) {
  const [document, setDocument] = useState<BrandDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing brand document on mount
  useEffect(() => {
    fetchBrandDocument();
  }, [userId]);

  const fetchBrandDocument = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${BRAND_API_URL}/brand-document?userId=${encodeURIComponent(userId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch brand document');
      }

      const data = await response.json();
      setDocument(data.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadBrandDocument = async (file: File) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    try {
      const response = await fetch(`${BRAND_API_URL}/brand-document`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      // Refresh document info
      await fetchBrandDocument();

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBrandDocument = async (documentId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${BRAND_API_URL}/brand-document/${documentId}?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      setDocument(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }

    const allowedTypes = ['application/pdf', 'text/csv', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, CSV, and TXT files are supported');
      return;
    }

    try {
      await uploadBrandDocument(file);
      alert('Brand document uploaded successfully!');
    } catch (err) {
      // Error already set in uploadBrandDocument
    }
  };

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="brand-document-manager">
      <h2>Brand Document</h2>

      {error && (
        <div className="error-message" style={{ color: 'red' }}>
          {error}
        </div>
      )}

      {document ? (
        <div className="document-info">
          <p><strong>Filename:</strong> {document.originalFilename}</p>
          <p><strong>Size:</strong> {formatFileSize(document.fileSize)}</p>
          <p><strong>Type:</strong> {document.contentType}</p>
          <p><strong>Uploaded:</strong> {new Date(document.createdAt).toLocaleString()}</p>

          <div className="actions">
            <label className="btn btn-primary">
              Replace Document
              <input
                type="file"
                accept=".pdf,.csv,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>

            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Are you sure you want to delete this brand document?')) {
                  deleteBrandDocument(document.id);
                }
              }}
            >
              Delete Document
            </button>
          </div>
        </div>
      ) : (
        <div className="upload-form">
          <p>Upload a brand document to help the CEO understand your business values and guidelines.</p>

          <label className="btn btn-primary">
            Upload Brand Document
            <input
              type="file"
              accept=".pdf,.csv,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>

          <p className="help-text">
            Supported formats: PDF, CSV, TXT (max 10MB)
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### Vanilla JavaScript Example

```javascript
const BRAND_API_URL = 'https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run';

// Fetch existing brand document
async function getBrandDocument(userId) {
  const response = await fetch(
    `${BRAND_API_URL}/brand-document?userId=${encodeURIComponent(userId)}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch brand document');
  }

  const data = await response.json();
  return data.document; // null if no document
}

// Upload brand document
async function uploadBrandDocument(userId, file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);

  const response = await fetch(`${BRAND_API_URL}/brand-document`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Upload failed');
  }

  return await response.json();
}

// Delete brand document
async function deleteBrandDocument(userId, documentId) {
  const response = await fetch(
    `${BRAND_API_URL}/brand-document/${documentId}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Delete failed');
  }

  return await response.json();
}

// Example usage
const userId = 'user-123';

// Check for existing document
const existingDoc = await getBrandDocument(userId);
if (existingDoc) {
  console.log('User has a brand document:', existingDoc.originalFilename);
}

// Upload new document
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const result = await uploadBrandDocument(userId, file);
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Upload failed:', error.message);
    }
  }
});
```

---

### cURL Examples

```bash
# Get existing brand document
curl -X GET "https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/brand-document?userId=user-123"

# Upload brand document
curl -X POST "https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/brand-document" \
  -F "file=@/path/to/brand-guide.pdf" \
  -F "userId=user-123"

# Delete brand document
curl -X DELETE "https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/brand-document/123?userId=user-123"

# Health check
curl -X GET "https://svc-01kc6g3ap8t1n90qmgm0ad0tjm.01kaznjk8gmz58tjkr7a40m5xj.lmapp.run/health"
```

---

## Error Handling

### Common Error Scenarios

| Error | Status Code | Cause | Solution |
|-------|-------------|-------|----------|
| `No file provided` | 400 | File missing from FormData | Ensure file is attached |
| `userId is required` | 400 | userId missing | Include userId in request |
| `File size exceeds 10MB limit` | 400 | File too large | Reduce file size or compress |
| `Invalid file type` | 400 | Unsupported file format | Use PDF, CSV, or TXT |
| `Brand document not found` | 404 | Document doesn't exist or wrong ID | Verify documentId is correct |
| `Failed to upload brand document` | 500 | Server error | Retry or contact support |

### Client-Side Validation

Always validate on the client-side before uploading:

```typescript
function validateBrandDocument(file: File): { valid: boolean; error?: string } {
  // Check file size (10MB limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  // Check file type
  const allowedTypes = ['application/pdf', 'text/csv', 'text/plain'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only PDF, CSV, and TXT files are supported' };
  }

  // Check file extension (backup validation)
  const allowedExtensions = ['.pdf', '.csv', '.txt'];
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'Invalid file extension' };
  }

  return { valid: true };
}
```

---

## Best Practices

### 1. User Experience

- **Show Upload Progress**: Use progress indicators for file uploads
- **Immediate Feedback**: Display success/error messages after operations
- **Confirm Deletions**: Always ask for confirmation before deleting
- **Display File Info**: Show filename, size, and upload date for existing documents

### 2. Performance

- **Lazy Load**: Only fetch brand document when user visits settings page
- **Cache Results**: Cache the document info to avoid repeated API calls
- **Optimize File Size**: Suggest users compress large files before upload

### 3. Security

- **Validate File Types**: Always validate file types on client-side
- **Sanitize User Input**: Encode userId in URL parameters
- **Handle Errors Gracefully**: Don't expose sensitive error details to users

### 4. Accessibility

- **Label Inputs**: Use proper labels for file inputs
- **Keyboard Navigation**: Ensure all actions are keyboard accessible
- **Screen Reader Support**: Provide aria-labels and descriptions

### 5. CEO Chat Integration

After uploading a brand document, inform users:

```typescript
// After successful upload
alert(
  'Brand document uploaded successfully! ' +
  'The CEO will now use your brand guidelines in all chat responses.'
);
```

---

## UI Recommendations

### Settings Page Layout

```
┌─────────────────────────────────────┐
│  Brand Document Settings            │
├─────────────────────────────────────┤
│                                     │
│  📄 Current Brand Document          │
│                                     │
│  Filename: brand-guidelines.pdf    │
│  Size: 2.5 MB                       │
│  Uploaded: Dec 11, 2025 10:30 AM   │
│                                     │
│  [Replace Document] [Delete]        │
│                                     │
│  ℹ️  The CEO uses this document to  │
│     align recommendations with      │
│     your brand values.              │
└─────────────────────────────────────┘
```

### Upload State

```
┌─────────────────────────────────────┐
│  Upload Brand Document              │
├─────────────────────────────────────┤
│                                     │
│  📤  Drag and drop your file here   │
│       or click to browse            │
│                                     │
│  Supported: PDF, CSV, TXT (max 10MB)│
│                                     │
│  💡 Include your brand guidelines,  │
│     mission statement, values, and  │
│     business description.           │
└─────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Upload a valid PDF document
- [ ] Upload a valid CSV document
- [ ] Upload a valid TXT document
- [ ] Try uploading a file > 10MB (should fail)
- [ ] Try uploading an unsupported file type (should fail)
- [ ] Replace an existing document
- [ ] Delete a document
- [ ] Check that CEO chat uses brand context after upload
- [ ] Verify error messages display correctly
- [ ] Test with empty userId (should fail)
- [ ] Test deleting non-existent document (should return 404)

---

## Support

For questions or issues:
- Check the error message returned by the API
- Verify your userId is correct
- Ensure file meets validation requirements (size, type)
- Contact backend team if issues persist

---

## Changelog

### v1.0.0 (2025-12-11)
- Initial release of Brand Document API
- Support for PDF, CSV, and TXT files
- Automatic CEO chat integration
- Single active document per user

---

**Last Updated:** December 11, 2025
**API Version:** 1.0.0
**Maintained By:** Virtual C-Suite Backend Team
