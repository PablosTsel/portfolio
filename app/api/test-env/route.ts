import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    // OpenAI API Key debugging
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...' || 'NOT SET',
    isPlaceholder: process.env.OPENAI_API_KEY?.includes('your_') || false,
    
    // Environment info
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || 'NOT SET',
    vercelUrl: process.env.VERCEL_URL || 'NOT SET',
    
    // Firebase configuration
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT SET',
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
    firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'NOT SET',
    
    // Request info
    requestUrl: request.url,
    requestHost: request.headers.get('host'),
    userAgent: request.headers.get('user-agent'),
    
    // All environment variables (filtered for security)
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('OPENAI') || 
      key.includes('FIREBASE') || 
      key.includes('VERCEL') ||
      key.includes('NODE_ENV')
    ),
    
    timestamp: new Date().toISOString(),
  });
} 