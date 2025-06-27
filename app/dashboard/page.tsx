'use client';

import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { 
  Plus, 
  Eye, 
  Edit3, 
  Share2, 
  Trash2, 
  RefreshCcw,
  Sun,
  Moon,
  LogOut,
  User,
  ExternalLink,
  FileText,
  Loader2,
  Settings,
  Home
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";

interface Portfolio {
  id: string;
  title: string;
  published: boolean;
  createdAt: any;
  updatedAt: any;
}

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeTab, setActiveTab] = useState('portfolios');
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);

  // Load portfolios from Firestore
  useEffect(() => {
    if (!user) {
      setLoadingPortfolios(false);
      return;
    }

    // Set up real-time listener for portfolios
    const portfoliosRef = collection(db, 'users', user.uid, 'portfolios');
    const q = query(portfoliosRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const portfoliosList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Portfolio));
      
      setPortfolios(portfoliosList);
      setLoadingPortfolios(false);
    }, (error) => {
      console.error('Error loading portfolios:', error);
      setLoadingPortfolios(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [user]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleDelete = async (portfolioId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this portfolio?')) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'users', user.uid, 'portfolios', portfolioId));
      
      // You might also want to delete from Firebase Storage here
      // But for now, we'll just remove from Firestore
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      alert('Failed to delete portfolio. Please try again.');
    }
  };

  const handleView = (portfolioId: string) => {
    window.open(`/portfolio/${portfolioId}`, '_blank');
  };

  const handleShare = (portfolioId: string) => {
    const url = `${window.location.origin}/portfolio/${portfolioId}`;
    navigator.clipboard.writeText(url);
    alert('Portfolio link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/20 bg-white/80 backdrop-blur-md dark:border-slate-800/20 dark:bg-slate-950/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                MakePortfolio
              </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-9 w-9 p-0"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Your Portfolios
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Welcome back, {user.displayName || user.email}
            </p>
          </div>
          <Button 
            className="mt-4 sm:mt-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            onClick={() => router.push('/generate')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Portfolio
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('portfolios')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'portfolios'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Portfolios
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>
        </div>

        {/* Portfolio Grid */}
        {activeTab === 'portfolios' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Loading State */}
            {loadingPortfolios && (
              <div className="col-span-full text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-300">Loading your portfolios...</p>
              </div>
            )}

            {/* Empty State */}
            {!loadingPortfolios && portfolios.length === 0 && (
              <div className="col-span-full">
                <div className="text-center py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                  {/* Template Preview */}
                  <div className="w-full max-w-md mx-auto mb-6 aspect-video bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg overflow-hidden relative">
                    <img 
                      src="/pictures/Template1.png" 
                      alt="Portfolio Template Preview" 
                      className="w-full h-full object-cover opacity-60 select-none"
                      style={{
                        imageRendering: 'auto',
                        transform: 'translate3d(0,0,0)',
                        backfaceVisibility: 'hidden'
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Plus className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    No portfolios yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-6">
                    Create your first portfolio by uploading your CV and let AI do the magic!
                  </p>
                  <Button 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    onClick={() => router.push('/generate')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Portfolio
                  </Button>
                </div>
              </div>
            )}

            {/* Portfolio Cards */}
            {!loadingPortfolios && portfolios.map((portfolio) => (
              <div key={portfolio.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
                {/* Card Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {portfolio.title || 'Untitled Portfolio'}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      portfolio.published 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {portfolio.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>

                {/* Card Preview */}
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center overflow-hidden">
                  <img 
                    src="/pictures/Template1.png" 
                    alt="Portfolio Template Preview" 
                    className="w-full h-full object-cover select-none"
                    style={{
                      imageRendering: 'auto',
                      transform: 'translate3d(0,0,0)',
                      backfaceVisibility: 'hidden'
                    }}
                  />
                </div>

                {/* Card Actions */}
                <div className="p-4 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleView(portfolio.id)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/portfolio/${portfolio.id}/edit`)}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleShare(portfolio.id)}
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1" />
                      Share
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    onClick={() => handleDelete(portfolio.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}

            {/* Create New Portfolio Card */}
            {!loadingPortfolios && portfolios.length > 0 && (
              <div 
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer group"
                onClick={() => router.push('/generate')}
              >
                {/* Template Preview */}
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center overflow-hidden relative">
                  <img 
                    src="/pictures/Template1.png" 
                    alt="Portfolio Template Preview" 
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity select-none"
                    style={{
                      imageRendering: 'auto',
                      transform: 'translate3d(0,0,0)',
                      backfaceVisibility: 'hidden'
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="h-8 w-8" />
                      </div>
                      <h3 className="text-lg font-bold mb-1">
                        Create New Portfolio
                      </h3>
                      <p className="text-sm opacity-90">
                        Upload your CV and generate with AI
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
                Account Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name
                  </label>
                  <p className="text-slate-900 dark:text-white">
                    {user.displayName || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <p className="text-slate-900 dark:text-white">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 