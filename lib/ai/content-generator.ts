import OpenAI from 'openai';
import { ParsedCV } from './information-parser';

export interface PortfolioContent extends ParsedCV {
  smallIntro: string;
  about: string;
  initials: string;
  projects: {
    name: string;
    description: string;
    imageUrl?: string;
    githubUrl?: string;
    reportUrl?: string;
  }[];
}

export class ContentGeneratorAgent {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async generateContent(parsedCV: ParsedCV): Promise<PortfolioContent> {
    // Generate initials from the full name
    const initials = parsedCV.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    // Generate engaging intro and about section
    const prompt = `Based on this person's CV information, create engaging web portfolio content.

Person's Information:
Name: ${parsedCV.fullName}
Title: ${parsedCV.title}
Skills: ${parsedCV.skills.map(s => s.name).join(', ')}
Experience: ${parsedCV.experience.map(e => `${e.position} at ${e.company}`).join(', ')}

Create:
1. A short intro (2-3 sentences) that captures their professional identity
2. An engaging "About Me" section (1-2 paragraphs) that sounds personal and professional
3. Enhanced project descriptions if they have any projects

Guidelines:
- Write in first person for the about section
- Keep it professional but friendly
- Avoid generic phrases like "passionate about" or "dedicated professional"
- Make it sound authentic and engaging
- Don't use flowery language - keep it natural

Return in JSON format:
{
  "smallIntro": "2-3 sentence intro",
  "about": "1-2 paragraph about section",
  "enhancedProjects": [{"name": "project name", "description": "enhanced description"}]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional portfolio content writer. Create engaging, authentic content that sounds natural and professional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content || '{}';
      
      // Clean up the response to ensure valid JSON
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }

      const generated = JSON.parse(jsonStr);

      // Merge enhanced projects with original project data
      const enhancedProjects = parsedCV.projects?.map((project, index) => {
        const enhanced = generated.enhancedProjects?.[index];
        return {
          ...project,
          description: enhanced?.description || project.description,
          imageUrl: '', // Will be filled by user later
          githubUrl: '', // Will be filled by user later
          reportUrl: '' // Will be filled by user later
        };
      }) || [];

      // If no projects exist, create some from experience
      if (enhancedProjects.length === 0 && parsedCV.experience.length > 0) {
        enhancedProjects.push(...parsedCV.experience.slice(0, 3).map(exp => ({
          name: `Project at ${exp.company}`,
          description: exp.description || `Key project during my role as ${exp.position}`,
          imageUrl: '',
          githubUrl: '',
          reportUrl: ''
        })));
      }

      return {
        ...parsedCV,
        smallIntro: generated.smallIntro,
        about: generated.about,
        initials,
        projects: enhancedProjects
      };
    } catch (error) {
      console.error('Error generating content:', error);
      
      // Fallback content if AI fails
      return {
        ...parsedCV,
        smallIntro: `${parsedCV.title} with expertise in ${parsedCV.skills.slice(0, 3).map(s => s.name).join(', ')}.`,
        about: `I am a ${parsedCV.title} with experience at ${parsedCV.experience[0]?.company || 'various companies'}. My technical skills include ${parsedCV.skills.slice(0, 5).map(s => s.name).join(', ')}, and I'm always eager to work on challenging projects that push the boundaries of what's possible.`,
        initials,
        projects: parsedCV.projects || []
      };
    }
  }
} 