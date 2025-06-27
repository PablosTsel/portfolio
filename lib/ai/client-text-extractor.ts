// Client-side text extraction for lighter serverless functions
export class ClientTextExtractorAgent {
  async extractText(file: File): Promise<string> {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await this.extractFromWordClientSide(file);
    } else {
      throw new Error('Unsupported file type. Please upload a Word document (.docx).');
    }
  }

  private async extractFromWordClientSide(file: File): Promise<string> {
    // Use a lightweight approach for Word document processing
    // This could use mammoth on the client side or a simplified extractor
    
    try {
      // For now, we'll use mammoth on client side if available
      // In production, you could use a third-party API or lightweight parser
      
      // Import mammoth dynamically only when needed
      const mammoth = await import('mammoth');
      const fileBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(fileBuffer);
      
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error extracting Word document on client:', error);
      
      // Fallback: try to extract some basic text
      // This is a very basic fallback - you could improve this
      try {
        const text = await file.text();
        return text || 'Unable to extract text from document';
      } catch (fallbackError) {
        return 'Please ensure your document is a valid Word file';
      }
    }
  }
} 