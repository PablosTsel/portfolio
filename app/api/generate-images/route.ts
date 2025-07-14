import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('🖼️ Starting image generation API...');
    
    const { projects, portfolioId, userId } = await request.json();
    
    if (!projects || !Array.isArray(projects)) {
      console.error('❌ Projects array is required');
      return NextResponse.json(
        { error: 'Projects array is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('✅ OpenAI API key found, length:', openaiApiKey.length);
    console.log('📊 Projects to process:', projects.length);

    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    // Generate images for each project with better error handling
    const projectsWithImages = await Promise.all(
      projects.map(async (project, index) => {
        try {
          console.log(`🔍 Analyzing project ${index + 1}/${projects.length}: ${project.name}`);
          
          // Use GPT to analyze the project and create a custom DALL-E prompt
          const promptAnalysis = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a professional designer creating minimalist project thumbnails. Create DALL-E prompts for clean, professional project images.'
              },
              {
                role: 'user',
                content: `Create a DALL-E prompt for a minimalist project thumbnail for: "${project.name}". 
                Description: ${project.description.substring(0, 200)}
                
                Requirements:
                - Minimalist, professional design
                - 2-3 colors maximum
                - White background
                - Clean, flat design
                - No text or words in the image
                - Technology/concept related iconography
                
                Return only the DALL-E prompt, maximum 100 words.`
              }
            ],
            temperature: 0.3,
            max_tokens: 150
          });

          const dallePrompt = promptAnalysis.choices[0].message.content?.trim() || 
            `Minimalist ${project.name} concept image with clean design, 2-3 colors, white background, flat style`;
          
          console.log(`📝 Generated prompt for ${project.name}: ${dallePrompt.substring(0, 50)}...`);
          
          // Generate the image with DALL-E with timeout
          const imagePromise = openai.images.generate({
            model: 'dall-e-3',
            prompt: dallePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            style: 'natural'
          });
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DALL-E timeout')), 25000)
          );
          
          const response = await Promise.race([imagePromise, timeoutPromise]) as any;

          const imageUrl = response.data?.[0]?.url;
          
          if (!imageUrl) {
            console.error(`❌ No image URL returned for project ${project.name}`);
            return project; // Return project without image
          }
          
          console.log(`✅ Image generated for ${project.name}`);

          // Download the image and convert to base64 with timeout
          const downloadPromise = fetch(imageUrl);
          const downloadTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Image download timeout')), 15000)
          );
          
          const imageResponse = await Promise.race([downloadPromise, downloadTimeoutPromise]) as Response;
          
          if (!imageResponse.ok) {
            console.error(`❌ Failed to download image for ${project.name}:`, imageResponse.status);
            return project;
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString('base64');
          
          console.log(`💾 Image downloaded and converted to base64 for ${project.name}`);

          return {
            ...project,
            imageUrl: imageUrl,
            imageData: {
              base64: imageBase64,
              mimeType: 'image/png',
              fileName: `project-${index}.png`,
              storagePath: portfolioId && userId ? `users/${userId}/portfolios/${portfolioId}/project-${index}.png` : null
            }
          };
        } catch (error) {
          console.error(`❌ Error generating image for project ${project.name}:`, error);
          
          // Return project without image data
          return {
            ...project,
            imageUrl: 'https://placehold.co/600x400/e2e8f0/1e293b?text=Project+Image', // Fallback placeholder
          };
        }
      })
    );

    console.log('✅ Image generation completed successfully');
    console.log(`📊 Results: ${projectsWithImages.filter(p => p.imageData).length}/${projects.length} images generated`);

    return NextResponse.json({ 
      success: true, 
      projects: projectsWithImages 
    });
  } catch (error) {
    console.error('❌ Error in image generation API:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack',
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 