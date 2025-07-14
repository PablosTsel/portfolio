import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...' || 'NOT SET',
    isPlaceholder: process.env.OPENAI_API_KEY?.includes('your_') || false,
    nodeEnv: process.env.NODE_ENV,
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
    timestamp: new Date().toISOString(),
  });
} 