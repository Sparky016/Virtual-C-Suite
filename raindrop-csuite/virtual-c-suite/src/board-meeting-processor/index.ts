import {
  BucketEventNotification,
  Each,
  Message,
} from "@liquidmetal-ai/raindrop-framework";
import { Env } from './raindrop.gen';

export default class extends Each<BucketEventNotification, Env> {
  async process(message: Message<BucketEventNotification>): Promise<void> {
    const { event } = message;
    
    console.log('Bucket event received:', {
      eventName: event.eventName,
      bucketName: event.bucketName,
      objectKey: event.objectKey,
      size: event.size,
      contentType: event.contentType,
      timestamp: new Date().toISOString()
    });

    switch (event.eventName) {
      case 'ObjectCreated:Put':
        await this.handleFileUpload(event);
        break;
      
      case 'ObjectRemoved:Delete':
        await this.handleFileDeletion(event);
        break;
      
      case 'ObjectCreated:Post':
        await this.handleMultiPartUpload(event);
        break;
      
      default:
        console.log('Unhandled event type:', event.eventName);
    }
  }

  // === File Upload Handler ===
  private async handleFileUpload(event: BucketEventNotification): Promise<void> {
    try {
      console.log(`Processing uploaded file: ${event.objectKey}`);
      
      // Example: Extract file information
      const fileInfo = {
        key: event.objectKey,
        size: event.size,
        contentType: event.contentType,
        uploadedAt: new Date().toISOString()
      };
      
      console.log('File info:', fileInfo);

      // Example: Call an actor to process the file
      // const processor = this.env.FILE_PROCESSOR_ACTOR;
      // await processor.postMessage({
      //   type: 'processFile',
      //   data: fileInfo
      // });

      // Example: Store file metadata in KV cache
      // const metadataCache = this.env.FILE_METADATA_KV;
      // await metadataCache.put(
      //   `file:${event.objectKey}`, 
      //   JSON.stringify(fileInfo),
      //   { expirationTtl: 86400 } // 24 hours
      // );

      // Example: Send notification to queue
      // const notificationQueue = this.env.NOTIFICATION_QUEUE;
      // await notificationQueue.send({
      //   body: JSON.stringify({
      //     type: 'file_uploaded',
      //     fileInfo,
      //     timestamp: new Date().toISOString()
      //   })
      // });

      // Example: If it's an image, trigger thumbnail generation
      if (event.contentType?.startsWith('image/')) {
        await this.triggerImageProcessing(event);
      }

      // Example: If it's a document, trigger text extraction
      if (this.isDocumentType(event.contentType)) {
        await this.triggerDocumentProcessing(event);
      }

    } catch (error) {
      console.error('Error handling file upload:', error);
      
      // Example: Send error notification
      // const errorQueue = this.env.ERROR_QUEUE;
      // await errorQueue.send({
      //   body: JSON.stringify({
      //     type: 'file_upload_error',
      //     error: error.message,
      //     fileInfo: {
      //       key: event.objectKey,
      //       bucket: event.bucketName
      //     },
      //     timestamp: new Date().toISOString()
      //   })
      // });
    }
  }

  // === File Deletion Handler ===
  private async handleFileDeletion(event: BucketEventNotification): Promise<void> {
    console.log(`Processing deleted file: ${event.objectKey}`);
    
    // Example: Clean up related data
    // const metadataCache = this.env.FILE_METADATA_KV;
    // await metadataCache.delete(`file:${event.objectKey}`);

    // Example: Notify other services
    // const cleanupQueue = this.env.CLEANUP_QUEUE;
    // await cleanupQueue.send({
    //   body: JSON.stringify({
    //     type: 'file_deleted',
    //     fileKey: event.objectKey,
    //     timestamp: new Date().toISOString()
    //   })
    // });

    // Example: Update search index
    // if (this.env.SMART_BUCKET) {
    //   try {
    //     // Remove from search index
    //     await this.env.SMART_BUCKET.delete({
    //       key: event.objectKey
    //     });
    //     console.log(`Removed ${event.objectKey} from search index`);
    //   } catch (error) {
    //     console.error('Failed to remove from search index:', error);
    //   }
    // }
  }

  // === Multi-part Upload Handler ===
  private async handleMultiPartUpload(event: BucketEventNotification): Promise<void> {
    console.log(`Processing multipart upload: ${event.objectKey}`);
    
    // Example: Trigger post-upload processing
    // const postProcessor = this.env.POST_UPLOAD_ACTOR;
    // await postProcessor.postMessage({
    //   type: 'processMultipartUpload',
    //   data: {
    //     key: event.objectKey,
    //     size: event.size,
    //     contentType: event.contentType
    //   }
    // });
  }

  // === Image Processing Example ===
  private async triggerImageProcessing(event: BucketEventNotification): Promise<void> {
    console.log(`Triggering image processing for: ${event.objectKey}`);
    
    // Example: Call image processing actor
    // const imageProcessor = this.env.IMAGE_PROCESSOR_ACTOR;
    // await imageProcessor.postMessage({
    //   type: 'generateThumbnails',
    //   data: {
    //     sourceKey: event.objectKey,
    //     bucket: event.bucketName,
    //     contentType: event.contentType
    //   }
    // });

    // Example: Extract EXIF data
    // const exifExtractor = this.env.EXIF_EXTRACTOR_ACTOR;
    // await exifExtractor.postMessage({
    //   type: 'extractExif',
    //   data: { key: event.objectKey }
    // });
  }

  // === Document Processing Example ===
  private async triggerDocumentProcessing(event: BucketEventNotification): Promise<void> {
    console.log(`Triggering document processing for: ${event.objectKey}`);
    
    // Example: Extract text and add to SmartBucket for search
    // const documentProcessor = this.env.DOCUMENT_PROCESSOR_ACTOR;
    // await documentProcessor.postMessage({
    //   type: 'extractAndIndex',
    //   data: {
    //     key: event.objectKey,
    //     bucket: event.bucketName,
    //     contentType: event.contentType
    //   }
    // });

    // Example: Generate document summary
    // const summarizer = this.env.DOCUMENT_SUMMARIZER_ACTOR;
    // await summarizer.postMessage({
    //   type: 'summarize',
    //   data: { key: event.objectKey }
    // });
  }

  // === Utility Functions ===
  private isDocumentType(contentType?: string): boolean {
    if (!contentType) return false;
    
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/csv'
    ];
    
    return documentTypes.includes(contentType);
  }

  // === Advanced Examples ===

  // Example: Batch processing for multiple files
  private async batchProcessFiles(events: BucketEventNotification[]): Promise<void> {
    console.log(`Batch processing ${events.length} files`);
    
    // Group by content type
    const grouped = events.reduce((acc, event) => {
      const type = event.contentType || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(event);
      return acc;
    }, {} as Record<string, BucketEventNotification[]>);

    // Process each group
    for (const [contentType, files] of Object.entries(grouped)) {
      console.log(`Processing ${files.length} files of type: ${contentType}`);
      
      if (contentType.startsWith('image/')) {
        // Process images in batch
        // const batchProcessor = this.env.IMAGE_BATCH_PROCESSOR;
        // await batchProcessor.postMessage({
        //   type: 'batchProcess',
        //   data: files.map(f => ({ key: f.objectKey, bucket: f.bucketName }))
        // });
      }
    }
  }

  // Example: File validation
  private async validateFile(event: BucketEventNotification): Promise<{ valid: boolean; reason?: string }> {
    // Check file size
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (event.size && event.size > maxSize) {
      return { valid: false, reason: 'File too large' };
    }

    // Check content type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain'
    ];

    if (event.contentType && !allowedTypes.includes(event.contentType)) {
      return { valid: false, reason: 'Unsupported file type' };
    }

    return { valid: true };
  }
}