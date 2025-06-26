import { NextRequest, NextResponse } from 'next/server';
import { ref, getBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const version = request.nextUrl.searchParams.get('version') || 'index';
    
    // Try to get the portfolio from Firebase Storage
    const portfolioRef = ref(storage, `portfolios/${id}/${version}.html`);
    
    try {
      const bytes = await getBytes(portfolioRef);
      const html = new TextDecoder().decode(bytes);
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          // Don't cache or use very short cache to avoid stale content
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch (error) {
      console.error(`Portfolio ${id}/${version}.html not found in Firebase Storage:`, error);
      
      // If final.html doesn't exist, try index.html
      if (version === 'final') {
        const indexRef = ref(storage, `portfolios/${id}/index.html`);
        try {
          const indexBytes = await getBytes(indexRef);
          const indexHtml = new TextDecoder().decode(indexBytes);
          
          return new NextResponse(indexHtml, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          });
        } catch (indexError) {
          console.error(`Portfolio ${id}/index.html also not found:`, indexError);
        }
      }
      
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error serving portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to load portfolio' },
      { status: 500 }
    );
  }
} 