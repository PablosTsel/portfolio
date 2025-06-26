import { NextRequest, NextResponse } from 'next/server';
import { TextExtractorAgent } from '@/lib/ai/text-extractor';
import { InformationParserAgent } from '@/lib/ai/information-parser';
import { ContentGeneratorAgent } from '@/lib/ai/content-generator';
import { generatePortfolioHTML } from '@/components/portfolio-template';
import { adminDb } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60; // Increase to 60 seconds for Netlify

export async function POST(request: NextRequest) {
  try {
    console.log('Starting portfolio generation...');
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('OPENAI') || key.includes('FIREBASE'))
    });
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      console.error('Missing file or user ID');
      return NextResponse.json(
        { error: 'Missing file or user ID' },
        { status: 400 }
      );
    }

    console.log(`Processing file: ${file.name} for user: ${userId}`);

    // Get OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - Missing API key' },
        { status: 500 }
      );
    }

    // Check if it's a placeholder
    if (openaiApiKey === 'your_openai_api_key_here' || openaiApiKey.includes('your_')) {
      console.error('OpenAI API key is still a placeholder!');
      return NextResponse.json(
        { error: 'Server configuration error - Invalid API key (placeholder detected)' },
        { status: 500 }
      );
    }

    console.log('OpenAI API key found, length:', openaiApiKey.length);

    try {
      // Step 1: Extract text from CV (fast)
      console.log('Step 1: Extracting text from CV...');
      const textExtractor = new TextExtractorAgent();
      const cvText = await textExtractor.extractText(file);
      console.log('CV text extracted, length:', cvText.length);

      // Step 2: Parse CV information (can be slow)
      console.log('Step 2: Parsing CV information with AI...');
      const informationParser = new InformationParserAgent(openaiApiKey);
      
      // Add timeout wrapper - increased to 25 seconds
      const parsePromise = informationParser.parseCV(cvText);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout - parsing stage')), 25000)
      );
      
      const parsedCV = await Promise.race([parsePromise, timeoutPromise]) as any;
      console.log('CV parsed successfully:', parsedCV.fullName);

      // Step 3: Generate engaging content (can be slow with GPT-4)
      console.log('Step 3: Generating portfolio content with GPT-4...');
      const contentGenerator = new ContentGeneratorAgent(openaiApiKey);
      
      // Add timeout wrapper for content generation - increased to 30 seconds for GPT-4
      const contentPromise = contentGenerator.generateContent(parsedCV);
      const contentTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Content generation timeout - GPT-4 is taking too long')), 30000)
      );
      
      const portfolioContent = await Promise.race([contentPromise, contentTimeoutPromise]) as any;
      console.log('Portfolio content generated');

      // Generate portfolio ID
      const portfolioId = randomUUID();
      console.log('Portfolio ID:', portfolioId);

      // Don't upload CV from server - let client handle it with proper auth
      console.log('CV upload will be handled by client with proper authentication...');
      
      // Get file extension for client upload
      const fileExtension = file.name.split('.').pop() || 'docx';
      const cvPath = `users/${userId}/portfolios/${portfolioId}/cv.${fileExtension}`;

      // Generate the portfolio HTML with placeholder CV URL
      console.log('Generating portfolio HTML...');
      const portfolioHTML = generatePortfolioHTML({
        data: portfolioContent,
        cvUrl: '', // Will be set by client after CV upload
        profilePictureUrl: undefined, // User can add this later
        githubProfile: undefined // User can add this later
      });

      // Convert file to base64 for client upload
      const fileBuffer = await file.arrayBuffer();
      const fileBase64 = Buffer.from(fileBuffer).toString('base64');

      // For production, we'll return the HTML and let the client save it
      // This avoids file system issues on serverless platforms
      console.log('Portfolio generation completed successfully!');
      return NextResponse.json({ 
        success: true, 
        portfolioId,
        portfolioHtml: portfolioHTML,
        portfolioUrl: `/portfolios/${portfolioId}`,
        // Include CV data for client-side upload
        cvData: {
          fileName: file.name,
          fileType: file.type,
          fileBase64: fileBase64,
          storagePath: cvPath
        }
      });
    } catch (timeoutError) {
      console.error('Operation timed out:', timeoutError);
      
      // Provide more specific error messages based on which step timed out
      const errorMessage = timeoutError instanceof Error ? timeoutError.message : 'Request timed out';
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 504 }
      );
    }
  } catch (error) {
    console.error('Detailed error in portfolio generation:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error type:', error?.constructor?.name);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: `Failed to generate portfolio: ${errorMessage}` },
      { status: 500 }
    );
  }
} 