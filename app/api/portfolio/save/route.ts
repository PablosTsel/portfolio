import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { portfolioId, html } = await request.json();
    
    if (!portfolioId || !html) {
      return NextResponse.json(
        { error: 'Missing portfolio ID or HTML content' },
        { status: 400 }
      );
    }
    
    // Return the HTML to the client so it can save to Firebase Storage
    // This avoids file system issues on serverless platforms
    return NextResponse.json({ 
      success: true,
      portfolioId,
      html,
      message: 'Portfolio prepared for saving'
    });
  } catch (error) {
    console.error('Error preparing portfolio for save:', error);
    return NextResponse.json(
      { error: 'Failed to prepare portfolio for saving' },
      { status: 500 }
    );
  }
} 