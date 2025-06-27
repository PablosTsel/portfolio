'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { use } from 'react';
import { ref, getDownloadURL, getBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export default function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [portfolioHtml, setPortfolioHtml] = useState('');
  const [exists, setExists] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  
  // Unwrap the params promise
  const { id } = use(params);

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        // Get parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const timestamp = urlParams.get('t') || Date.now();
        const success = urlParams.get('success');
        
        // Show success popup if success parameter is present
        if (success === 'true') {
          setShowSuccessPopup(true);
          
          // Clean URL by removing success parameter but keeping timestamp
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('success');
          window.history.replaceState({}, '', newUrl.toString());
          
          // Auto-hide popup after 5 seconds
          setTimeout(() => {
            setShowSuccessPopup(false);
          }, 5000);
        }
        
        // Try to load from our API endpoint which handles Firebase Storage internally
        try {
          // First try the final version with timestamp to bypass cache
          const finalResponse = await fetch(`/api/portfolio/${id}?version=final&t=${timestamp}`, {
            cache: 'no-store'
          });
          if (finalResponse.ok) {
            const finalHtml = await finalResponse.text();
            setPortfolioHtml(finalHtml);
            setExists(true);
            setLoading(false);
            return;
          }
        } catch (finalError) {
          console.log('Final version API failed:', finalError);
        }

        try {
          // Try the draft version with timestamp
          const draftResponse = await fetch(`/api/portfolio/${id}?version=index&t=${timestamp}`, {
            cache: 'no-store'
          });
          if (draftResponse.ok) {
            const draftHtml = await draftResponse.text();
            setPortfolioHtml(draftHtml);
            setExists(true);
            setLoading(false);
            return;
          }
        } catch (draftError) {
          console.log('Draft version API failed:', draftError);
        }

        // If API fails, try static files as fallback
        try {
          // First check if the final version exists as static file
          let response = await fetch(`/portfolios/${id}/final.html`, { method: 'HEAD' });
          
          if (response.ok) {
            // Redirect to the final HTML file
            window.location.href = `/portfolios/${id}/final.html`;
            return;
          } else {
            // Check if the draft version exists as static file
            response = await fetch(`/portfolios/${id}/index.html`, { method: 'HEAD' });
            
            if (response.ok) {
              // Redirect to the draft HTML file
              window.location.href = `/portfolios/${id}/index.html`;
              return;
            }
          }
        } catch (staticError) {
          console.error('Static file check failed:', staticError);
        }

        // Nothing found
        setExists(false);
        setLoading(false);
      } catch (error) {
        console.error('Error loading portfolio:', error);
        setExists(false);
        setLoading(false);
      }
    };

    loadPortfolio();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-300">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!exists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Portfolio Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            This portfolio doesn't exist or has been removed.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // If we have HTML content, render it in an iframe
  if (portfolioHtml) {
    return (
      <div className="relative">
        {/* Success Popup */}
        {showSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 mx-4 max-w-md w-full transform animate-in fade-in zoom-in duration-500 border border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                🎉 Portfolio is Live!
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4 text-center">
                Your portfolio has been successfully saved and is now live. Share it with the world!
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Automatically closing...</span>
              </div>
            </div>
          </div>
        )}
        
        <iframe
          srcDoc={portfolioHtml}
          style={{
            width: '100vw',
            height: '100vh',
            border: 'none',
            margin: 0,
            padding: 0,
            display: 'block'
          }}
          title="Portfolio"
        />
      </div>
    );
  }

  return null;
} 