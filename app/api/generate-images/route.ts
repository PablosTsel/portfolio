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

    // Check if we should skip AI image generation (for faster/more reliable portfolio creation)
    const skipAIImages = process.env.SKIP_AI_IMAGE_GENERATION === 'true';
    
    if (skipAIImages) {
      console.log('Skipping AI image generation, using placeholder images');
      
      const projectsWithPlaceholders = projects.map((project, index) => {
        const projectNameLower = project.name.toLowerCase();
        let imageUrl = '';
        
        if (projectNameLower.includes('spotify') || projectNameLower.includes('music')) {
          imageUrl = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop';
        } else if (projectNameLower.includes('football') || projectNameLower.includes('sports')) {
          imageUrl = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop';
        } else if (projectNameLower.includes('ai') || projectNameLower.includes('machine learning') || projectNameLower.includes('samplex')) {
          imageUrl = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop';
        } else if (projectNameLower.includes('data') || projectNameLower.includes('analytics') || projectNameLower.includes('challenge')) {
          imageUrl = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop';
        } else if (projectNameLower.includes('web') || projectNameLower.includes('app')) {
          imageUrl = 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=600&h=400&fit=crop';
        } else {
          imageUrl = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop';
        }
        
        return {
          ...project,
          imageUrl: imageUrl
        };
      });
      
      return NextResponse.json({ 
        success: true, 
        projects: projectsWithPlaceholders 
      });
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
          console.log(`Generating image for project: ${project.name}`);
          console.log(`Using description: ${project.description}`);
          
          // Create a minimalistic prompt based on the actual project description
          const descriptionBasedPrompt = await createImagePromptFromDescription(openai, project.name, project.description);
          
          console.log(`Generated prompt: ${descriptionBasedPrompt}`);
          
          try {
            // Add timeout protection for DALL-E 3
            const imageGenerationPromise = openai.images.generate({
              model: "dall-e-3",
              prompt: descriptionBasedPrompt,
              n: 1,
              size: "1024x1024",
              quality: "standard",
              style: "natural"  // Natural style for more minimalistic results
            });
            
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('DALL-E timeout after 45 seconds')), 45000)
            );
            
            const response = await Promise.race([imageGenerationPromise, timeoutPromise]);

            const imageUrl = response.data?.[0]?.url;
            
            if (!imageUrl) {
              throw new Error('No image URL returned from OpenAI');
            }
            
            console.log(`Successfully generated image for ${project.name}`);
            
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
          } catch (imageGenError: any) {
            console.error(`OpenAI image generation failed for ${project.name}:`, imageGenError.message);
            console.error('Full error:', imageGenError);
            
            // Use fallback placeholder based on description keywords
            const fallbackImage = createFallbackImage(project.description);
            console.log(`Using fallback image for ${project.name}: ${fallbackImage}`);
            return {
              ...project,
              imageUrl: fallbackImage
            };
          }
        } catch (error: any) {
          console.error(`Error processing project ${project.name}:`, error);
          // Return project with placeholder image
          return {
            ...project,
            imageUrl: 'https://placehold.co/600x400/e2e8f0/1e293b?text=Project+Image'
          };
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

// Function to create an image prompt based on the project description
async function createImagePromptFromDescription(openai: OpenAI, projectName: string, description: string): Promise<string> {
  try {
    // Use GPT to extract key visual concepts from the project description
    const promptCreationResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating minimalistic image prompts for DALL-E based on project descriptions. 

IMPORTANT RULES:
- Create EXTREMELY minimalistic and clean designs
- Use maximum 2-3 colors only
- Focus on simple geometric shapes
- Include lots of white space
- NO gradients, shadows, or complex details
- NO text or words in the image
- Think abstract and symbolic representation

Your task: Extract the main concepts/technologies/purpose from the project description and create a minimalistic visual prompt that represents the essence of the project.`
        },
        {
          role: "user",
          content: `Project: ${projectName}
Description: ${description}

Create a minimalistic DALL-E prompt that visually represents this project. Focus on the core technology/concept mentioned in the description. Make it extremely simple and clean.`
        }
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    const extractedPrompt = promptCreationResponse.choices[0]?.message?.content || '';
    
    // Ensure minimalistic style is emphasized
    const finalPrompt = `Ultra minimalistic design, extremely simple and clean: ${extractedPrompt}. Use maximum 2-3 colors, simple geometric shapes only, lots of white space, no gradients, no shadows, no complex details, no text.`;
    
    return finalPrompt;
  } catch (error) {
    console.error('Error creating prompt from description:', error);
    
    // Fallback: create a simple prompt based on common keywords in the description
    const descriptionLower = description.toLowerCase();
    let fallbackPrompt = '';
    
    if (descriptionLower.includes('machine learning') || descriptionLower.includes('ai')) {
      fallbackPrompt = 'Minimalistic AI visualization: Simple connected dots forming abstract neural network, purple on white, extremely minimal geometric design';
    } else if (descriptionLower.includes('web') || descriptionLower.includes('website') || descriptionLower.includes('frontend')) {
      fallbackPrompt = 'Minimalistic web interface: Simple geometric rectangles representing UI elements, blue and white only, clean abstract design';
    } else if (descriptionLower.includes('data') || descriptionLower.includes('analytics') || descriptionLower.includes('visualization')) {
      fallbackPrompt = 'Minimalistic data visualization: Three simple geometric bars in different heights, single blue color on white background';
    } else if (descriptionLower.includes('mobile') || descriptionLower.includes('app')) {
      fallbackPrompt = 'Minimalistic mobile app: Simple phone outline with geometric interface elements, two colors maximum, ultra clean';
    } else if (descriptionLower.includes('game') || descriptionLower.includes('gaming')) {
      fallbackPrompt = 'Minimalistic gaming: Simple geometric shapes representing game elements, bright colors on white, abstract minimal';
    } else if (descriptionLower.includes('api') || descriptionLower.includes('backend') || descriptionLower.includes('server')) {
      fallbackPrompt = 'Minimalistic API visualization: Simple connected geometric nodes, green and white only, clean abstract network';
    } else {
      fallbackPrompt = 'Minimalistic technology: Simple hexagon pattern, single color on white background, geometric minimal design';
    }
    
    return `Ultra minimalistic design, extremely simple and clean: ${fallbackPrompt}. Use maximum 2-3 colors, simple geometric shapes only, lots of white space, no gradients, no shadows, no complex details, no text.`;
  }
}

// Function to create fallback placeholder image based on description
function createFallbackImage(description: string): string {
  const descriptionLower = description.toLowerCase();
  
  if (descriptionLower.includes('machine learning') || descriptionLower.includes('ai')) {
    return 'https://placehold.co/600x400/9333ea/ffffff?text=AI+Project';
  } else if (descriptionLower.includes('web') || descriptionLower.includes('website') || descriptionLower.includes('frontend')) {
    return 'https://placehold.co/600x400/3b82f6/ffffff?text=Web+Project';
  } else if (descriptionLower.includes('data') || descriptionLower.includes('analytics')) {
    return 'https://placehold.co/600x400/0ea5e9/ffffff?text=Data+Project';
  } else if (descriptionLower.includes('mobile') || descriptionLower.includes('app')) {
    return 'https://placehold.co/600x400/f97316/ffffff?text=Mobile+App';
  } else if (descriptionLower.includes('game') || descriptionLower.includes('gaming')) {
    return 'https://placehold.co/600x400/ec4899/ffffff?text=Game+Project';
  } else if (descriptionLower.includes('api') || descriptionLower.includes('backend')) {
    return 'https://placehold.co/600x400/10b981/ffffff?text=Backend+Project';
  } else {
    return 'https://placehold.co/600x400/6366f1/ffffff?text=Tech+Project';
  }
} 