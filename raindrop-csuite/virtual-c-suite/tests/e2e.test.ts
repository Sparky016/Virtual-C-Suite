import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';

// Configuration
const API_URL = 'http://localhost:3000'; // Adjust if Raindrop runs on a different port
const TEST_FILES_DIR = join(__dirname, '../../tests/scenarios');

describe('Virtual C-Suite E2E Tests', () => {
  
  // Helper to upload a file
  async function uploadFile(filename: string, contentType: string, content?: Buffer) {
    const formData = new FormData();
    const fileContent = content || readFileSync(join(TEST_FILES_DIR, filename));
    const blob = new Blob([fileContent], { type: contentType });
    formData.append('file', blob, filename);
    formData.append('userId', 'test-user');

    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    return response;
  }

  it('should successfully upload a valid CSV file (Happy Path)', async () => {
    const response = await uploadFile('struggling_bakery.csv', 'text/csv');
    expect(response.status).toBe(201); // Created
    
    const data = await response.json() as { requestId: string; status: string };
    expect(data).toHaveProperty('requestId');
    expect(data.status).toBe('processing');
  });

  it('should reject an invalid file type', async () => {
    // Create a dummy .exe file
    const content = Buffer.from('fake exe content');
    const response = await uploadFile('malware.exe', 'application/x-msdownload', content);
    
    // Assuming backend returns 400 for invalid types
    expect(response.status).toBe(400); 
  });

  it('should handle empty files gracefully', async () => {
    const content = Buffer.from('');
    const response = await uploadFile('empty.txt', 'text/plain', content);
    
    expect(response.status).toBe(400); // Should reject empty files
  });

  it('should track status of a request', async () => {
    // 1. Upload
    const uploadRes = await uploadFile('tech_startup.csv', 'text/csv');
    const { requestId } = await uploadRes.json() as { requestId: string };

    // 2. Poll Status
    const statusRes = await fetch(`${API_URL}/status/${requestId}`);
    expect(statusRes.status).toBe(200);
    
    const statusData = await statusRes.json() as { status: string };
    expect(statusData).toHaveProperty('status');
    expect(['pending', 'processing', 'completed']).toContain(statusData.status);
  });

  it('should handle unstructured text files', async () => {
    const response = await uploadFile('retail_store.txt', 'text/plain');
    expect(response.status).toBe(201);
    const data = await response.json() as { requestId: string };
    expect(data).toHaveProperty('requestId');
  });

  it('should reject files that are too large (>10MB)', async () => {
    // Simulate large file
    const largeContent = Buffer.alloc(11 * 1024 * 1024, 'a'); // 11MB
    const response = await uploadFile('large_dataset.csv', 'text/csv', largeContent);
    expect(response.status).toBe(413); // Payload Too Large
  });

  it('should handle malformed CSVs gracefully (might accept but produce warning)', async () => {
    const response = await uploadFile('malformed.csv', 'text/csv');
    // The system should probably accept it and let the AI figure it out, or fail analysis later.
    // For upload API, it should likely be 201.
    expect(response.status).toBe(201);
  });
});
