import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BoardMeetingProcessor from './index';

// Mock types
const createMockEnv = () => ({
  INPUT_BUCKET: {
    get: vi.fn(),
  },
  OUTPUT_BUCKET: {
    put: vi.fn(),
  },
  TRACKING_DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn(),
      }),
    }),
  },
  AI: {
    run: vi.fn(),
  },
  POSTHOG_API_KEY: 'test-key',
});

// Mock Services
// We mock the modules but we need to ensure the constructors return the mocked instances
const mockDatabaseService = {
  createExecutiveAnalysis: vi.fn(),
  createFinalReport: vi.fn(),
  updateAnalysisRequestStatus: vi.fn(),
};

const mockStorageService = {
  get: vi.fn(),
  put: vi.fn(),
};

const mockAIOrchestrationService = {
  executeExecutiveAnalyses: vi.fn().mockResolvedValue({
    cfo: { analysis: 'cfo', duration: 100 },
    cmo: { analysis: 'cmo', duration: 100 },
    coo: { analysis: 'coo', duration: 100 },
  }),
  executeCEOSynthesis: vi.fn().mockResolvedValue({
    synthesis: 'ceo',
    duration: 100,
  }),
};

vi.mock('../services/DatabaseService', () => {
  return {
    DatabaseService: vi.fn().mockImplementation(() => mockDatabaseService),
  };
});

vi.mock('../services/StorageService', () => {
  return {
    StorageService: vi.fn().mockImplementation(() => mockStorageService),
  };
});

vi.mock('../services/AIOrchestrationService', () => {
  return {
    AIOrchestrationService: vi.fn().mockImplementation(() => mockAIOrchestrationService),
  };
});

describe('BoardMeetingProcessor', () => {
  let env: any;
  let processor: any;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    env = createMockEnv();
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as any;
    processor = new BoardMeetingProcessor(env, mockCtx);
    // Manually set env because the mock framework instantiation might differ or base class behavior isn't reproduced purely by `new` in tests without the framework's mechanics
    processor.env = env;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should process file upload event', async () => {
    // Setup message
    const message = {
      body: {
        action: 'PutObject',
        bucket: 'input-bucket',
        object: { key: 'test.pdf', size: 1024 },
        eventTime: new Date().toISOString(),
      },
    };

    // Mock StorageService.get behavior via the mock implementation in handleFileUpload
    // Note: Since we are mocking the class constructor, we need to spy on the instance methods created inside the method
    // But since the method instantiates new services every time, we rely on the mocked module behavior defined above.
    // However, to make assertions on specific call arguments or return values, we might want to access the mock instances.

    // Ideally we would inject services or use a factory, but here we can rely on the fact that the services are mocked globally.
    // To make specific mock behaviors for THIS test (like returning a specific file), we need to access the mock class.

    // Setup specific mock response for this test
    mockStorageService.get.mockResolvedValue({
      text: () => Promise.resolve('content'),
      customMetadata: { requestId: 'req-1', userId: 'user-1' },
    });

    await processor.process(message as any);

    expect(mockStorageService.get).toHaveBeenCalledWith('test.pdf');
  });

  it('should handle file not found', async () => {
    const message = {
      body: {
        action: 'PutObject',
        bucket: 'input-bucket',
        object: { key: 'missing.pdf', size: 1024 },
        eventTime: new Date().toISOString(),
      },
    };

    mockStorageService.get.mockResolvedValue(null);

    await processor.process(message as any);

    expect(mockStorageService.get).toHaveBeenCalledWith('missing.pdf');
  });

  it('should handle missing requestId', async () => {
    const message = {
      body: {
        action: 'PutObject',
        bucket: 'input-bucket',
        object: { key: 'no-id.pdf', size: 1024 },
        eventTime: new Date().toISOString(),
      },
    };

    mockStorageService.get.mockResolvedValue({
      text: () => Promise.resolve('content'),
      customMetadata: {}, // No requestId
    });

    await processor.process(message as any);

    expect(mockStorageService.get).toHaveBeenCalledWith('no-id.pdf');
  });
});
