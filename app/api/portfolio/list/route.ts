import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET() {
  try {
    const portfoliosDir = join(process.cwd(), 'public', 'portfolios');
    
    // Get all portfolio directories
    const portfolioDirs = await readdir(portfoliosDir);
    
    const portfolios = await Promise.all(
      portfolioDirs.map(async (id) => {
        const portfolioPath = join(portfoliosDir, id);
        const stats = await stat(portfolioPath);
        
        if (stats.isDirectory()) {
          // Check if final.html exists, otherwise check for index.html
          const finalPath = join(portfolioPath, 'final.html');
          const indexPath = join(portfolioPath, 'index.html');
          
          let hasPortfolio = false;
          let isFinal = false;
          
          if (existsSync(finalPath)) {
            hasPortfolio = true;
            isFinal = true;
          } else if (existsSync(indexPath)) {
            hasPortfolio = true;
          }
          
          if (hasPortfolio) {
            // Try to extract name from the HTML file
            let name = 'Portfolio';
            try {
              const htmlPath = isFinal ? finalPath : indexPath;
              const html = await readFile(htmlPath, 'utf-8');
              
              // Extract name from title or h1
              const titleMatch = html.match(/<title>([^<]+)<\/title>/);
              if (titleMatch) {
                name = titleMatch[1].replace(' - Portfolio', '').trim();
              } else {
                const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
                if (h1Match) {
                  name = h1Match[1].replace(/Hi, I'm |Hello, I'm /g, '').trim();
                }
              }
            } catch (error) {
              console.error('Error reading portfolio HTML:', error);
            }
            
            return {
              id,
              name,
              template: 'template1',
              status: isFinal ? 'completed' : 'draft',
              createdAt: stats.birthtime,
              updatedAt: stats.mtime
            };
          }
        }
        
        return null;
      })
    );
    
    // Filter out null values and sort by creation date
    const validPortfolios = portfolios
      .filter(p => p !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return NextResponse.json({ 
      portfolios: validPortfolios 
    });
  } catch (error) {
    console.error('Error listing portfolios:', error);
    return NextResponse.json(
      { error: 'Failed to list portfolios' },
      { status: 500 }
    );
  }
} 