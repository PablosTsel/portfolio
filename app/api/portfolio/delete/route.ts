import { NextRequest, NextResponse } from 'next/server';
import { rm } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { portfolioId } = await request.json();
    
    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Missing portfolio ID' },
        { status: 400 }
      );
    }
    
    // Delete the portfolio directory
    const portfolioDir = join(process.cwd(), 'public', 'portfolios', portfolioId);
    
    await rm(portfolioDir, { recursive: true, force: true });
    
    console.log(`Portfolio ${portfolioId} deleted successfully`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Portfolio deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to delete portfolio' },
      { status: 500 }
    );
  }
} 