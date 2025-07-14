'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { 
  Upload, 
  FileText, 
  Loader2, 
  Sun, 
  Moon,
  ArrowLeft,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function GeneratePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'upload' | 'processing' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      // Validate file type - only Word documents
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload a Word document (.docx)');
        return;
      }
      
      // Validate file size (10MB max)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setStep('processing');
    setError('');

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.uid);

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate portfolio');
      }

      const data = await response.json();
      
      // Make sure we actually got a successful response with HTML
      if (!data.success || !data.portfolioHtml) {
        throw new Error(data.error || 'Failed to generate portfolio');
      }
      
      // Upload the CV file to Firebase Storage if provided
      let finalPortfolioHtml = data.portfolioHtml;
      if (data.cvData) {
        try {
          console.log('Uploading CV to Firebase Storage...');
          
          // Convert base64 back to bytes
          const cvBytes = Uint8Array.from(atob(data.cvData.fileBase64), c => c.charCodeAt(0));
          
          // Upload to Firebase Storage
          const cvRef = ref(storage, data.cvData.storagePath);
          await uploadBytes(cvRef, cvBytes, {
            contentType: data.cvData.fileType,
          });
          
          // Get download URL
          const cvUrl = await getDownloadURL(cvRef);
          console.log('CV uploaded successfully, URL:', cvUrl);
          
          // Update the portfolio HTML to include the CV download URL
          // Replace the empty cvUrl with the actual URL
          finalPortfolioHtml = data.portfolioHtml.replace(
            'cvUrl: \'\'', 
            `cvUrl: '${cvUrl}'`
          ).replace(
            'cvUrl,', 
            `cvUrl: '${cvUrl}',`
          );
          
          // More reliable replacement - look for the hero-buttons section and add the download button
          if (!finalPortfolioHtml.includes('Download CV')) {
            finalPortfolioHtml = finalPortfolioHtml.replace(
              /<div class="hero-buttons">\s*<a href="#contact" class="btn primary-btn">\s*Contact\s*<\/a>\s*<\/div>/,
              `<div class="hero-buttons">
                    <a href="#contact" class="btn primary-btn">
                        Contact
                    </a>
                    <a href="${cvUrl}" target="_blank" class="btn secondary-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download CV
                    </a>
                </div>`
            );
          }
          
        } catch (cvError) {
          console.error('Error uploading CV:', cvError);
          // Continue without CV download - don't fail the whole process
        }
      }
      
      // Upload project images to Firebase Storage if provided
      if (data.projectImages && Array.isArray(data.projectImages)) {
        console.log('Uploading project images to Firebase Storage...');
        
        for (const projectImage of data.projectImages) {
          if (projectImage.imageData && projectImage.imageData.storagePath) {
            try {
              // Convert base64 to bytes
              const imageBytes = Uint8Array.from(atob(projectImage.imageData.base64), c => c.charCodeAt(0));
              
              // Upload to Firebase Storage
              const imageRef = ref(storage, projectImage.imageData.storagePath);
              await uploadBytes(imageRef, imageBytes, {
                contentType: projectImage.imageData.mimeType,
              });
              
              // Get download URL
              const imageUrl = await getDownloadURL(imageRef);
              console.log(`Project image uploaded: ${projectImage.name} -> ${imageUrl}`);
              
              // Replace the temporary DALL-E URL with the Firebase Storage URL in the HTML
              finalPortfolioHtml = finalPortfolioHtml.replace(
                projectImage.tempUrl,
                imageUrl
              );
            } catch (imageError) {
              console.error(`Error uploading project image ${projectImage.name}:`, imageError);
              // Continue with other images
            }
          }
        }
      }
      
      // Save the portfolio HTML to Firebase Storage
      if (finalPortfolioHtml) {
        const portfolioRef = ref(storage, `portfolios/${data.portfolioId}/index.html`);
        await uploadString(portfolioRef, finalPortfolioHtml, 'raw', {
          contentType: 'text/html',
        });
        
        console.log('Portfolio saved to Firebase Storage successfully');
        
        // Create Firestore document for the portfolio
        try {
          const portfolioDoc = doc(db, 'users', user.uid, 'portfolios', data.portfolioId);
          await setDoc(portfolioDoc, {
            title: file.name.replace(/\.[^/.]+$/, ''), // Use filename without extension as initial title
            published: false, // Not published until edited and saved
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log('Portfolio metadata saved to Firestore');
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          // Don't fail the whole operation if Firestore fails
        }
      }
      
      clearInterval(progressInterval);
      setProgress(100);
      setStep('complete');

      // Redirect to the generated portfolio after a short delay
      setTimeout(() => {
        router.push(`/portfolio/${data.portfolioId}/edit`);
      }, 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setError('Failed to generate portfolio. Please try again.');
      setStep('upload');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/20 bg-white/80 backdrop-blur-md dark:border-slate-800/20 dark:bg-slate-950/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                MakePortfolio
              </h1>
            </div>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9 p-0"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Generate Your Portfolio with AI
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Upload your CV and let our AI create a stunning portfolio in seconds
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {step === 'upload' && (
              <>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-12 text-center">
                  <input
                    type="file"
                    id="cv-upload"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <label
                    htmlFor="cv-upload"
                    className="cursor-pointer group"
                  >
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      {file ? (
                        <FileText className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Upload className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    
                    {file ? (
                      <div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                          {file.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Click to change file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                          Drop your CV here or click to browse
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Supports Word documents only (.docx) - max 10MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  size="lg"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                >
                  Generate Portfolio
                </Button>
              </>
            )}

            {step === 'processing' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                
                <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
                  AI is analyzing your CV...
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                  This usually takes 30-60 seconds
                </p>

                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {progress}% complete
                </p>

                <div className="mt-8 space-y-3 text-left max-w-sm mx-auto">
                  <div className={`flex items-center ${progress >= 30 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span>Extracting text from CV</span>
                  </div>
                  <div className={`flex items-center ${progress >= 60 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span>Parsing information</span>
                  </div>
                  <div className={`flex items-center ${progress >= 90 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span>Generating content</span>
                  </div>
                </div>
              </div>
            )}

            {step === 'complete' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                
                <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
                  Portfolio Generated Successfully!
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  Redirecting to your new portfolio...
                </p>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                  1. Upload CV
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Upload your CV in Word format (.docx)
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                  2. AI Processing
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Our AI extracts and enhances your information
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                  3. Portfolio Ready
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Your professional portfolio is live and shareable
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 