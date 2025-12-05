// FileValidationService Tests - Pure unit tests, zero dependencies
import { describe, test, expect, beforeEach } from 'vitest';
import { FileValidationService } from './FileValidationService';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  describe('validateFileSize', () => {
    test('accepts files under the size limit', () => {
      // Create a 1MB file (well under 10MB limit)
      const file = createMockFile('test.csv', 'text/csv', 1 * 1024 * 1024);

      const result = service.validateFileSize(file);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.details).toBeUndefined();
    });

    test('accepts files at exactly the size limit', () => {
      // Create a 10MB file (exactly at limit)
      const file = createMockFile('test.csv', 'text/csv', 10 * 1024 * 1024);

      const result = service.validateFileSize(file);

      expect(result.isValid).toBe(true);
    });

    test('rejects files over the size limit', () => {
      // Create a 15MB file (over 10MB limit)
      const file = createMockFile('large.csv', 'text/csv', 15 * 1024 * 1024);

      const result = service.validateFileSize(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File size exceeds 10MB limit');
      expect(result.details).toBeDefined();
      expect(result.details?.reason).toBe('file_size_exceeded');
      expect(result.details?.received).toBe('15.00');
      expect(result.details?.limit).toBe(10);
    });

    test('rejects files just over the limit', () => {
      // Create a 10.1MB file
      const file = createMockFile('test.csv', 'text/csv', 10.1 * 1024 * 1024);

      const result = service.validateFileSize(file);

      expect(result.isValid).toBe(false);
      expect(result.details?.received).toBe('10.10');
    });

    test('handles zero-byte files', () => {
      const file = createMockFile('empty.csv', 'text/csv', 0);

      const result = service.validateFileSize(file);

      expect(result.isValid).toBe(true);
    });

    test('handles very small files', () => {
      const file = createMockFile('tiny.csv', 'text/csv', 100); // 100 bytes

      const result = service.validateFileSize(file);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFileType', () => {
    test('accepts CSV files by extension', () => {
      const result = service.validateFileType('data.csv', 'text/csv');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts CSV files by content type', () => {
      const result = service.validateFileType('data.unknown', 'text/csv');

      expect(result.isValid).toBe(true);
    });

    test('accepts PDF files by extension', () => {
      const result = service.validateFileType('document.pdf', 'application/pdf');

      expect(result.isValid).toBe(true);
    });

    test('accepts TXT files by extension', () => {
      const result = service.validateFileType('notes.txt', 'text/plain');

      expect(result.isValid).toBe(true);
    });

    test('rejects JPEG files', () => {
      const result = service.validateFileType('photo.jpg', 'image/jpeg');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file type');
      expect(result.details?.reason).toBe('invalid_file_type');
      expect(result.details?.received).toBe('image/jpeg');
    });

    test('rejects PNG files', () => {
      const result = service.validateFileType('image.png', 'image/png');

      expect(result.isValid).toBe(false);
    });

    test('rejects executable files', () => {
      const result = service.validateFileType('virus.exe', 'application/x-msdownload');

      expect(result.isValid).toBe(false);
    });

    test('rejects ZIP files', () => {
      const result = service.validateFileType('archive.zip', 'application/zip');

      expect(result.isValid).toBe(false);
    });

    test('is case-insensitive for extensions', () => {
      const result1 = service.validateFileType('DATA.CSV', 'text/csv');
      const result2 = service.validateFileType('data.CSV', 'text/csv');
      const result3 = service.validateFileType('DaTa.CsV', 'text/csv');

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
      expect(result3.isValid).toBe(true);
    });

    test('handles files without extensions', () => {
      const result = service.validateFileType('noextension', 'text/csv');

      // Should pass if content type is valid
      expect(result.isValid).toBe(true);
    });

    test('handles empty filenames', () => {
      const result = service.validateFileType('', 'text/csv');

      expect(result.isValid).toBe(true);
    });

    test('validates by extension when content type is unknown', () => {
      const result = service.validateFileType('data.csv', 'application/octet-stream');

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFile', () => {
    test('accepts valid files', () => {
      const file = createMockFile('data.csv', 'text/csv', 5 * 1024 * 1024);

      const result = service.validateFile(file);

      expect(result.isValid).toBe(true);
    });

    test('rejects files with invalid size', () => {
      const file = createMockFile('large.csv', 'text/csv', 15 * 1024 * 1024);

      const result = service.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.details?.reason).toBe('file_size_exceeded');
    });

    test('rejects files with invalid type', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg', 1 * 1024 * 1024);

      const result = service.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.details?.reason).toBe('invalid_file_type');
    });

    test('checks size before type (fail fast)', () => {
      // Large invalid type file - should fail on size first
      const file = createMockFile('huge.jpg', 'image/jpeg', 20 * 1024 * 1024);

      const result = service.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.details?.reason).toBe('file_size_exceeded');
    });

    test('validates a typical valid CSV upload', () => {
      const file = createMockFile('sales-data.csv', 'text/csv', 2.5 * 1024 * 1024);

      const result = service.validateFile(file);

      expect(result.isValid).toBe(true);
    });

    test('validates a typical valid PDF upload', () => {
      const file = createMockFile('report.pdf', 'application/pdf', 3 * 1024 * 1024);

      const result = service.validateFile(file);

      expect(result.isValid).toBe(true);
    });
  });

  describe('getFileSizeMB', () => {
    test('calculates file size in MB correctly', () => {
      const file = createMockFile('test.csv', 'text/csv', 5 * 1024 * 1024);

      const sizeMB = service.getFileSizeMB(file);

      expect(sizeMB).toBe(5);
    });

    test('returns decimal values for fractional MB', () => {
      const file = createMockFile('test.csv', 'text/csv', 2.5 * 1024 * 1024);

      const sizeMB = service.getFileSizeMB(file);

      expect(sizeMB).toBe(2.5);
    });

    test('handles bytes correctly', () => {
      const file = createMockFile('test.csv', 'text/csv', 1024 * 1024); // 1MB

      const sizeMB = service.getFileSizeMB(file);

      expect(sizeMB).toBe(1);
    });

    test('handles zero-byte files', () => {
      const file = createMockFile('empty.csv', 'text/csv', 0);

      const sizeMB = service.getFileSizeMB(file);

      expect(sizeMB).toBe(0);
    });

    test('returns small decimal for tiny files', () => {
      const file = createMockFile('tiny.csv', 'text/csv', 512 * 1024); // 0.5MB

      const sizeMB = service.getFileSizeMB(file);

      expect(sizeMB).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    test('handles files with multiple dots in name', () => {
      const result = service.validateFileType('my.data.file.csv', 'text/csv');

      expect(result.isValid).toBe(true);
    });

    test('handles files with special characters', () => {
      const result = service.validateFileType('data-2024_v2.csv', 'text/csv');

      expect(result.isValid).toBe(true);
    });

    test('handles very long filenames', () => {
      const longName = 'a'.repeat(200) + '.csv';
      const result = service.validateFileType(longName, 'text/csv');

      expect(result.isValid).toBe(true);
    });

    test('handles unicode characters in filename', () => {
      const result = service.validateFileType('données-📊.csv', 'text/csv');

      expect(result.isValid).toBe(true);
    });
  });
});

// Helper function to create mock File objects
function createMockFile(name: string, type: string, size: number): File {
  const file = new File(['content'], name, { type });
  // Override the size property
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  });
  return file;
}
