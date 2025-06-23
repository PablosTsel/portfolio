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

    // Step 1: Extract text from CV
    console.log('Step 1: Extracting text from CV...');
    const textExtractor = new TextExtractorAgent();
    const cvText = await textExtractor.extractText(file);
    console.log('CV text extracted, length:', cvText.length);

    // Step 2: Parse CV information
    console.log('Step 2: Parsing CV information with AI...');
    const informationParser = new InformationParserAgent(openaiApiKey);
    const parsedCV = await informationParser.parseCV(cvText);
    console.log('CV parsed successfully:', parsedCV.fullName);

    // Step 3: Generate engaging content
    console.log('Step 3: Generating portfolio content...');
    const contentGenerator = new ContentGeneratorAgent(openaiApiKey);
    const portfolioContent = await contentGenerator.generateContent(parsedCV);
    console.log('Portfolio content generated');

    // Generate portfolio ID
    const portfolioId = randomUUID();
    console.log('Portfolio ID:', portfolioId);

    // Skip Firebase Storage upload for now - will be handled client-side
    console.log('Skipping CV upload to Firebase Storage (will be handled client-side)...');
    const cvUrl = ''; // Will be updated later when client uploads

    // Generate the portfolio HTML
    console.log('Generating portfolio HTML...');
    const portfolioHTML = generatePortfolioHTML({
      data: portfolioContent,
      cvUrl,
      profilePictureUrl: undefined, // User can add this later
      githubProfile: undefined // User can add this later
    });

    // For production, we'll return the HTML and let the client save it
    // This avoids file system issues on serverless platforms
    console.log('Portfolio generation completed successfully!');
    return NextResponse.json({ 
      success: true, 
      portfolioId,
      portfolioHtml: portfolioHTML,
      portfolioUrl: `/portfolios/${portfolioId}`
    });
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