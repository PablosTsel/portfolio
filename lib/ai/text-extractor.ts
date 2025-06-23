import mammoth from 'mammoth';

export class TextExtractorAgent {
  async extractText(file: File): Promise<string> {
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await this.extractFromWord(buffer);
    } else {
      throw new Error('Unsupported file type. Please upload a Word document (.docx).');
    }
  }

  private async extractFromWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error extracting Word document:', error);
      throw new Error('Failed to extract text from Word document');
    }
  }
} 