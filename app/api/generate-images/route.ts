import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { projects, portfolioId, userId } = await request.json();
    
    if (!projects || !Array.isArray(projects)) {
      return NextResponse.json(
        { error: 'Projects array is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    // Generate images for each project
    const projectsWithImages = await Promise.all(
      projects.map(async (project, index) => {
        try {
          // Use GPT to analyze the project and create a custom DALL-E prompt
          console.log(`Analyzing project: ${project.name}`);
          
          const promptGeneration = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at creating DALL-E prompts. Create minimalist but RELEVANT image prompts that capture the essence of each project.'
              },
              {
                role: 'user',
                content: `Create a DALL-E prompt for this project:
                
Project Name: ${project.name}
Project Description: ${project.description}

REQUIREMENTS:
1. MINIMALIST DESIGN - Simple geometric shapes and clean lines
2. RELEVANT TO PROJECT - Must visually represent what the project is about
3. Use 2-3 colors maximum on white background
4. Flat design (no gradients or shadows)
5. Think of it as a simple icon that represents the project

Examples:
- For a Spotify music project: "Simple music note shapes in Spotify green and black. White background. Flat minimalist design."
- For a data analytics project: "Three simple bar chart rectangles in blue. White background. Minimal flat design."
- For an AI project: "Connected dots forming simple neural network pattern. Blue and purple. White background."

The image should be simple but CLEARLY related to: ${project.name}

Keep prompt under 40 words. Make it RELEVANT to the project topic.`
              }
            ],
            temperature: 0.7,
            max_tokens: 100
          });

          const prompt = promptGeneration.choices[0].message.content || 'Simple abstract technology pattern. Basic geometric shapes in gradient colors. Minimal, clean, flat design style. No details, no text, no logos.';
          
          console.log(`Generated prompt: ${prompt}`);
          
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data?.[0]?.url;
          
          if (!imageUrl) {
            console.error(`No image URL returned for project ${project.name}`);
            return project;
          }
          
          // Download the image and convert to base64
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString('base64');
          
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
          console.error(`Error generating image for project ${project.name}:`, error);
          // Return project without image if generation fails
          return project;
        }
      })
    );

    return NextResponse.json({ 
      success: true, 
      projects: projectsWithImages 
    });
  } catch (error) {
    console.error('Error in image generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate images' },
      { status: 500 }
    );
  }
} 