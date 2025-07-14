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
          content: `You are an expert at creating simple icon-style prompts for DALL-E based on project descriptions. 

CRITICAL RULES - FOLLOW EXACTLY:
- Create prompts for simple ICONS or SYMBOLS only (like app icons)
- NO graphs, charts, decision trees, or complex visualizations
- NO text, words, letters, or numbers in the image
- Use only 1-2 simple geometric shapes or recognizable symbols
- Maximum 2 colors (plus white background)
- Think like designing a simple app icon or logo
- Focus on ONE main symbol that represents the project essence

Examples of GOOD concepts:
- Music project → simple music note symbol
- Data project → simple database cylinder icon
- Web project → simple browser window outline
- AI project → simple brain outline or neural node
- Game project → simple controller icon
- Mobile app → simple phone outline

AVOID: Complex data visualizations, multiple elements, detailed illustrations, graphs, trees, networks with many nodes.`
        },
        {
          role: "user",
          content: `Project: ${projectName}
Description: ${description}

Create a DALL-E prompt for a simple icon that represents this project. Focus on ONE simple symbol/icon that relates to the main technology or purpose mentioned. Make it as simple as a mobile app icon.`
        }
      ],
      max_tokens: 100,
      temperature: 0.2,
    });

    const extractedPrompt = promptCreationResponse.choices[0]?.message?.content || '';
    
    // Heavily emphasize simplicity and icon-style design
    const finalPrompt = `Simple minimalistic icon design: ${extractedPrompt}. Single clean symbol on white background, maximum 2 colors, no text, no complex details, no graphs, no charts, app icon style, extremely simple geometric design.`;
    
    return finalPrompt;
  } catch (error) {
    console.error('Error creating prompt from description:', error);
    
    // Fallback: create simple icon-style prompts based on keywords
    const descriptionLower = description.toLowerCase();
    let fallbackPrompt = '';
    
    // Technology-based icons (more generic)
    if (descriptionLower.includes('music') || descriptionLower.includes('song') || descriptionLower.includes('audio')) {
      fallbackPrompt = 'Simple music note icon, green and white, minimalistic symbol';
    } else if (descriptionLower.includes('ai') || descriptionLower.includes('machine learning') || descriptionLower.includes('neural') || descriptionLower.includes('model')) {
      fallbackPrompt = 'Simple brain outline icon, purple and white, minimalistic symbol';
    } else if (descriptionLower.includes('web') || descriptionLower.includes('website') || descriptionLower.includes('frontend') || descriptionLower.includes('browser') || descriptionLower.includes('html') || descriptionLower.includes('css')) {
      fallbackPrompt = 'Simple browser window icon, blue and white, minimalistic symbol';
    } else if (descriptionLower.includes('data') || descriptionLower.includes('database') || descriptionLower.includes('analytics') || descriptionLower.includes('sql')) {
      fallbackPrompt = 'Simple database cylinder icon, blue and white, minimalistic symbol';
    } else if (descriptionLower.includes('mobile') || descriptionLower.includes('app') || descriptionLower.includes('android') || descriptionLower.includes('ios') || descriptionLower.includes('flutter') || descriptionLower.includes('react native')) {
      fallbackPrompt = 'Simple smartphone icon, orange and white, minimalistic symbol';
    } else if (descriptionLower.includes('game') || descriptionLower.includes('gaming') || descriptionLower.includes('unity') || descriptionLower.includes('godot')) {
      fallbackPrompt = 'Simple game controller icon, pink and white, minimalistic symbol';
    } else if (descriptionLower.includes('api') || descriptionLower.includes('backend') || descriptionLower.includes('server') || descriptionLower.includes('node') || descriptionLower.includes('express')) {
      fallbackPrompt = 'Simple server rack icon, green and white, minimalistic symbol';
    } else if (descriptionLower.includes('finance') || descriptionLower.includes('trading') || descriptionLower.includes('stock') || descriptionLower.includes('payment')) {
      fallbackPrompt = 'Simple dollar sign icon, green and white, minimalistic symbol';
    } else if (descriptionLower.includes('social') || descriptionLower.includes('chat') || descriptionLower.includes('messaging') || descriptionLower.includes('communication')) {
      fallbackPrompt = 'Simple chat bubble icon, blue and white, minimalistic symbol';
    } else if (descriptionLower.includes('ecommerce') || descriptionLower.includes('shopping') || descriptionLower.includes('store') || descriptionLower.includes('cart')) {
      fallbackPrompt = 'Simple shopping cart icon, orange and white, minimalistic symbol';
    } else if (descriptionLower.includes('python') || descriptionLower.includes('django') || descriptionLower.includes('flask')) {
      fallbackPrompt = 'Simple snake icon, blue and white, minimalistic symbol';
    } else if (descriptionLower.includes('react') || descriptionLower.includes('javascript') || descriptionLower.includes('typescript') || descriptionLower.includes('js')) {
      fallbackPrompt = 'Simple code brackets icon, blue and white, minimalistic symbol';
    } else if (descriptionLower.includes('blockchain') || descriptionLower.includes('crypto') || descriptionLower.includes('ethereum')) {
      fallbackPrompt = 'Simple chain link icon, orange and white, minimalistic symbol';
    } else if (descriptionLower.includes('health') || descriptionLower.includes('medical') || descriptionLower.includes('fitness')) {
      fallbackPrompt = 'Simple heart icon, red and white, minimalistic symbol';
    } else if (descriptionLower.includes('education') || descriptionLower.includes('learning') || descriptionLower.includes('course')) {
      fallbackPrompt = 'Simple book icon, blue and white, minimalistic symbol';
    } else if (descriptionLower.includes('food') || descriptionLower.includes('recipe') || descriptionLower.includes('restaurant')) {
      fallbackPrompt = 'Simple fork and knife icon, orange and white, minimalistic symbol';
    } else if (descriptionLower.includes('travel') || descriptionLower.includes('map') || descriptionLower.includes('location')) {
      fallbackPrompt = 'Simple location pin icon, red and white, minimalistic symbol';
    } else if (descriptionLower.includes('photo') || descriptionLower.includes('image') || descriptionLower.includes('camera')) {
      fallbackPrompt = 'Simple camera icon, purple and white, minimalistic symbol';
    } else {
      // Generic fallback for completely unknown projects
      fallbackPrompt = 'Simple geometric hexagon icon, purple and white, minimalistic symbol';
    }
    
    return `Simple minimalistic icon design: ${fallbackPrompt}. Single clean symbol on white background, no text, no complex details, app icon style, extremely simple.`;
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