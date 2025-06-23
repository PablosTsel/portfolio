'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { use } from 'react';

export default function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  
  // Unwrap the params promise
  const { id } = use(params);

  useEffect(() => {
    const checkPortfolio = async () => {
      try {
        // First check if the final version exists
        let response = await fetch(`/portfolios/${id}/final.html`, { method: 'HEAD' });
        
        if (response.ok) {
          setExists(true);
          // Redirect to the final HTML file
          window.location.href = `/portfolios/${id}/final.html`;
        } else {
          // Check if the draft version exists
          response = await fetch(`/portfolios/${id}/index.html`, { method: 'HEAD' });
          
          if (response.ok) {
            setExists(true);
            // Redirect to the draft HTML file
            window.location.href = `/portfolios/${id}/index.html`;
          } else {
            setExists(false);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error checking portfolio:', error);
        setExists(false);
        setLoading(false);
      }
    };

    checkPortfolio();
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

  return null;
} 