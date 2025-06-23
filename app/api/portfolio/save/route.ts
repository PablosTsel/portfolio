import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { portfolioId, html } = await request.json();
    
    if (!portfolioId || !html) {
      return NextResponse.json(
        { error: 'Missing portfolio ID or HTML content' },
        { status: 400 }
      );
    }
    
    // Save the final portfolio to a new file
    const publicDir = join(process.cwd(), 'public', 'portfolios', portfolioId);
    const finalPath = join(publicDir, 'final.html');
    
    // Write the final HTML file
    await writeFile(finalPath, html);
    
    console.log(`Final portfolio saved for ${portfolioId}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Portfolio saved successfully'
    });
  } catch (error) {
    console.error('Error saving portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to save portfolio' },
      { status: 500 }
    );
  }
} 