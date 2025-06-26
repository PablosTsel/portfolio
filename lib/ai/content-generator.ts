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
Projects: ${parsedCV.projects?.map(p => `${p.name}: ${p.description}`).join(', ') || 'None listed'}

Create the following content:

1. smallIntro (CRITICAL: 10-15 words maximum)
   - Clear, professional tagline that captures expertise
   - Straightforward, no dramatic language
   - Example: "Full-stack developer specializing in React and Node.js applications"

2. about (CRITICAL: 150-200 words)
   - Start with "Hello! I'm [name]..."
   - Write in first person
   - Conversational and genuine tone
   - Focus on: current role/studies, key achievements, passions, what drives them
   - Like introducing yourself to a colleague, not marketing copy
   - Avoid flowery language and clichés

3. enhancedProjects (CRITICAL: Each description MUST be 45-60 words)
   - If projects exist in CV: Expand each to exactly 45-60 words
   - If no projects: Create exactly 3 realistic sample projects based on their skills
   - Each description must explain: what it does, technologies used, and impact/outcome
   - Be engaging and specific
   - Focus on problem solved, technologies used, and impact

Return in JSON format:
{
  "smallIntro": "10-15 word professional tagline",
  "about": "150-200 word about section starting with Hello! I'm...",
  "enhancedProjects": [
    {
      "name": "Project Name",
      "description": "45-60 word description explaining what it does, technologies used, and impact"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4', // Using GPT-4 for better content generation
        messages: [
          {
            role: 'system',
            content: 'You are a professional portfolio content writer. Create engaging, authentic content that sounds natural and professional. Follow all word count limits strictly.'
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

      // If no projects exist, create some from experience or skills
      if (enhancedProjects.length === 0) {
        // Generate exactly 3 sample projects based on skills
        const sampleProjects = [];
        
        if (parsedCV.skills.length > 0) {
          // Create diverse projects based on their skill set
          sampleProjects.push({
            name: `${parsedCV.skills[0]?.name || 'Web'} Application`,
            description: `Built a full-featured application using ${parsedCV.skills[0]?.name || 'modern technologies'} to solve real-world problems. Implemented responsive design, user authentication, and data management features. The project demonstrates proficiency in both frontend and backend development, resulting in improved user experience and efficient data processing.`,
            imageUrl: '',
            githubUrl: '',
            reportUrl: ''
          });
          
          if (parsedCV.skills.length > 1) {
            sampleProjects.push({
              name: `${parsedCV.skills[1]?.name || 'Data'} Analytics Tool`,
              description: `Developed an analytics tool leveraging ${parsedCV.skills[1]?.name || 'data processing'} to provide insights and visualizations. Created interactive dashboards and automated reporting features. This solution helped streamline decision-making processes and improved data accessibility for stakeholders across the organization.`,
              imageUrl: '',
              githubUrl: '',
              reportUrl: ''
            });
          }
          
          sampleProjects.push({
            name: `API Integration Project`,
            description: `Designed and implemented a RESTful API using ${parsedCV.skills[2]?.name || 'backend technologies'} to connect multiple services. Focused on security, scalability, and performance optimization. The integration reduced manual processes by 70% and enabled real-time data synchronization across platforms.`,
            imageUrl: '',
            githubUrl: '',
            reportUrl: ''
          });
        }
        
        enhancedProjects.push(...sampleProjects.slice(0, 3));
      }

      return {
        ...parsedCV,
        smallIntro: generated.smallIntro,
        about: generated.about,
        initials,
        projects: enhancedProjects
      };
    } catch (error) {
      console.error('Error generating content with GPT-4:', error);
      
      // Try with GPT-3.5-turbo as fallback
      console.log('Falling back to GPT-3.5-turbo...');
      try {
        const fallbackResponse = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a professional portfolio content writer. Create engaging, authentic content that sounds natural and professional. Follow all word count limits strictly.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        });

        const fallbackContent = fallbackResponse.choices[0].message.content || '{}';
        
        // Clean up the response to ensure valid JSON
        let jsonStr = fallbackContent;
        if (fallbackContent.includes('```json')) {
          jsonStr = fallbackContent.split('```json')[1].split('```')[0].trim();
        } else if (fallbackContent.includes('```')) {
          jsonStr = fallbackContent.split('```')[1].split('```')[0].trim();
        }

        const generated = JSON.parse(jsonStr);

        // Merge enhanced projects with original project data
        const enhancedProjects = parsedCV.projects?.map((project, index) => {
          const enhanced = generated.enhancedProjects?.[index];
          return {
            ...project,
            description: enhanced?.description || project.description,
            imageUrl: '',
            githubUrl: '',
            reportUrl: ''
          };
        }) || [];

        // If no projects exist, create some from experience or skills
        if (enhancedProjects.length === 0) {
          // Use the same project generation logic
          const sampleProjects = [];
          
          if (parsedCV.skills.length > 0) {
            sampleProjects.push({
              name: `${parsedCV.skills[0]?.name || 'Web'} Application`,
              description: `Built a full-featured application using ${parsedCV.skills[0]?.name || 'modern technologies'} to solve real-world problems. Implemented responsive design, user authentication, and data management features. The project demonstrates proficiency in both frontend and backend development, resulting in improved user experience and efficient data processing.`,
              imageUrl: '',
              githubUrl: '',
              reportUrl: ''
            });
            
            if (parsedCV.skills.length > 1) {
              sampleProjects.push({
                name: `${parsedCV.skills[1]?.name || 'Data'} Analytics Tool`,
                description: `Developed an analytics tool leveraging ${parsedCV.skills[1]?.name || 'data processing'} to provide insights and visualizations. Created interactive dashboards and automated reporting features. This solution helped streamline decision-making processes and improved data accessibility for stakeholders across the organization.`,
                imageUrl: '',
                githubUrl: '',
                reportUrl: ''
              });
            }
            
            sampleProjects.push({
              name: `API Integration Project`,
              description: `Designed and implemented a RESTful API using ${parsedCV.skills[2]?.name || 'backend technologies'} to connect multiple services. Focused on security, scalability, and performance optimization. The integration reduced manual processes by 70% and enabled real-time data synchronization across platforms.`,
              imageUrl: '',
              githubUrl: '',
              reportUrl: ''
            });
          }
          
          enhancedProjects.push(...sampleProjects.slice(0, 3));
        }

        return {
          ...parsedCV,
          smallIntro: generated.smallIntro,
          about: generated.about,
          initials,
          projects: enhancedProjects
        };
      } catch (fallbackError) {
        console.error('Error with GPT-3.5 fallback:', fallbackError);
        
        // Final fallback content if both AI attempts fail
        return {
          ...parsedCV,
          smallIntro: `${parsedCV.title} with expertise in ${parsedCV.skills.slice(0, 3).map(s => s.name).join(', ')}.`,
          about: `Hello! I'm ${parsedCV.fullName}. I am a ${parsedCV.title} with experience at ${parsedCV.experience[0]?.company || 'various companies'}. My technical skills include ${parsedCV.skills.slice(0, 5).map(s => s.name).join(', ')}, and I'm always eager to work on challenging projects that push the boundaries of what's possible. I enjoy solving complex problems and building solutions that make a real impact.`,
          initials,
          projects: parsedCV.projects || []
        };
      }
    }
  }
} 