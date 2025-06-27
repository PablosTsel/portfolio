import { NextRequest, NextResponse } from 'next/server';
import { InformationParserAgent } from '@/lib/ai/information-parser';
import { ContentGeneratorAgent } from '@/lib/ai/content-generator';
import { generatePortfolioHTML } from '@/components/portfolio-template';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('Starting light portfolio generation...');
    
    // Parse JSON data instead of form data
    const { cvText, userId, fileName } = await request.json();

    if (!cvText || !userId) {
      console.error('Missing CV text or user ID');
      return NextResponse.json(
        { error: 'Missing CV text or user ID' },
        { status: 400 }
      );
    }

    console.log(`Processing extracted text for user: ${userId}, CV length: ${cvText.length}`);

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
      // Step 1: Parse CV information (can be slow)
      console.log('Step 1: Parsing CV information with AI...');
      const informationParser = new InformationParserAgent(openaiApiKey);
      
      // Add timeout wrapper - increased to 25 seconds
      const parsePromise = informationParser.parseCV(cvText);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout - parsing stage')), 25000)
      );
      
      const parsedCV = await Promise.race([parsePromise, timeoutPromise]) as any;
      console.log('CV parsed successfully:', parsedCV.fullName);

      // Step 2: Generate engaging content (can be slow with GPT-4)
      console.log('Step 2: Generating portfolio content with GPT-4...');
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

      // Generate the portfolio HTML without CV URL (will be added client-side)
      console.log('Generating portfolio HTML...');
      const portfolioHTML = generatePortfolioHTML({
        data: portfolioContent,
        cvUrl: '', // Will be set by client after CV upload
        profilePictureUrl: undefined,
        githubProfile: undefined
      });

      console.log('Light portfolio generation completed successfully!');
      return NextResponse.json({ 
        success: true, 
        portfolioId,
        portfolioHtml: portfolioHTML,
        portfolioUrl: `/portfolios/${portfolioId}`,
        fileName: fileName || 'cv.docx'
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
    console.error('Detailed error in light portfolio generation:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error type:', error?.constructor?.name);
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: `Failed to generate portfolio: ${errorMessage}` },
      { status: 500 }
    );
  }
} 