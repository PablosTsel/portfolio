# Deployment Environment Variables

## Required Environment Variables for Production

### OpenAI API Configuration
```
OPENAI_API_KEY=your_openai_api_key_here
```

### Firebase Client Configuration (CRITICAL - App will crash without these!)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Firebase Admin Configuration (For API routes)
```
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"
```

### Optional
```
SKIP_AI_IMAGE_GENERATION=false
```

## Common Client-Side Error Causes

1. **Missing NEXT_PUBLIC_* variables** - These are needed by the browser
2. **Firebase Auth Domain** - Must match your deployment domain in Firebase Console
3. **Version conflicts** - Clear cache and restart

## Vercel Environment Variables Setup

1. Go to your Vercel dashboard
2. Select your project  
3. Go to Settings → Environment Variables
4. Add all the variables above
5. Redeploy the project

## Debugging Steps

1. Check browser console for specific error messages
2. Verify all NEXT_PUBLIC_* environment variables are set
3. Ensure Firebase Auth Domain includes your deployment domain
4. Clear browser cache and try again 