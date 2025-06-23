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

    // Save portfolio data to Firestore
    console.log('Skipping Firestore save for now - will add back later...');
    // TODO: Set up proper Firebase Admin authentication
    /*
    await adminDb.collection('portfolios').doc(portfolioId).set({
      userId,
      name: portfolioContent.fullName,
      email: portfolioContent.email,
      template: 'template1',
      data: portfolioContent,
      cvUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'completed'
    });
    */

    // Create the public portfolio directory
    console.log('Creating portfolio directory...');
    const publicDir = join(process.cwd(), 'public', 'portfolios', portfolioId);
    
    // Create directory if it doesn't exist
    if (!existsSync(publicDir)) {
      await mkdir(publicDir, { recursive: true });
    }

    // Write the HTML file
    await writeFile(join(publicDir, 'index.html'), portfolioHTML);
    console.log('Portfolio HTML file created');

    console.log('Portfolio generation completed successfully!');
    return NextResponse.json({ 
      success: true, 
      portfolioId,
      portfolioUrl: `/portfolios/${portfolioId}`
    });
  } catch (error) {
    console.error('Detailed error in portfolio generation:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: `Failed to generate portfolio: ${errorMessage}` },
      { status: 500 }
    );
  }
} 