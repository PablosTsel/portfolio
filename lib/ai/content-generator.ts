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

CRITICAL INSTRUCTIONS - FOLLOW WORD COUNTS EXACTLY:

1. smallIntro (EXACTLY 10-15 words - COUNT EVERY WORD)
   - Clear, professional tagline that captures expertise
   - Straightforward, no dramatic language
   - Example: "Full-stack developer specializing in React and Node.js applications" (8 words - ADD MORE)
   - MUST be between 10-15 words, not less, not more

2. about (EXACTLY 150-200 words - COUNT EVERY WORD)
   - Start with "Hello! I'm [name]..."
   - Write in first person
   - Conversational and genuine tone
   - Focus on: current role/studies, key achievements, passions, what drives them
   - Like introducing yourself to a colleague, not marketing copy
   - Avoid flowery language and clichés
   - MUST be between 150-200 words - if you write less than 150 words, ADD MORE CONTENT

3. enhancedProjects (EACH DESCRIPTION EXACTLY 130-150 words - COUNT EVERY SINGLE WORD)
   - If projects exist in CV: Expand each to EXACTLY 130-150 words
   - If no projects: Create exactly 3 realistic sample projects based on their skills
   - Each description must explain: what it does, technologies used, and impact/outcome
   - Be engaging and specific
   - Focus on problem solved, technologies used, and impact
   - WARNING: If any description is under 130 words, you FAILED the task
   - REQUIREMENT: Every project description must be AT LEAST 130 words and NO MORE than 150 words

WORD COUNT VERIFICATION:
- Count words in your response before submitting
- smallIntro: 10-15 words (count them!)
- about: 150-200 words (count them!)
- Each project description: 130-150 words (count them!)

Return in JSON format:
{
  "smallIntro": "EXACTLY 10-15 word professional tagline",
  "about": "EXACTLY 150-200 word about section starting with Hello! I'm...",
  "enhancedProjects": [
    {
      "name": "Project Name",
      "description": "EXACTLY 130-150 word description explaining what it does, technologies used, and impact"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4', // Using GPT-4 for better content generation
        messages: [
          {
            role: 'system',
            content: 'You are a professional portfolio content writer. Your #1 priority is to follow word count limits EXACTLY. Count every single word before responding. If a section requires 130-150 words, it must have AT LEAST 130 words and NO MORE than 150 words. If you provide fewer words than requested, you have FAILED the task. Create engaging, authentic content that sounds natural and professional while strictly adhering to word count requirements.'
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
            description: `Built a comprehensive full-stack application using ${parsedCV.skills[0]?.name || 'modern technologies'} to solve real-world problems and improve user experience. The project features responsive design, secure user authentication, and efficient data management capabilities. Implemented advanced functionality including real-time updates, data visualization, and automated processes. The solution demonstrates proficiency in both frontend and backend development, resulting in improved user experience, streamlined workflows, and efficient data processing that reduced manual tasks by 60% and increased overall system performance.`,
            imageUrl: '',
            githubUrl: '',
            reportUrl: ''
          });
          
          if (parsedCV.skills.length > 1) {
            sampleProjects.push({
              name: `${parsedCV.skills[1]?.name || 'Data'} Analytics Tool`,
              description: `Developed a comprehensive analytics platform leveraging ${parsedCV.skills[1]?.name || 'data processing'} technologies to provide meaningful insights and interactive visualizations for stakeholders. Created dynamic dashboards with automated reporting features, data filtering capabilities, and export functionality. The tool processes large datasets efficiently and presents complex information in an intuitive format. This solution significantly streamlined decision-making processes, improved data accessibility across the organization, and enabled real-time monitoring of key performance indicators, resulting in 40% faster reporting and enhanced strategic planning capabilities.`,
              imageUrl: '',
              githubUrl: '',
              reportUrl: ''
            });
          }
          
          sampleProjects.push({
            name: `API Integration Project`,
            description: `Designed and implemented a robust RESTful API system using ${parsedCV.skills[2]?.name || 'backend technologies'} to seamlessly connect multiple services and platforms. Focused on security best practices, scalability optimization, and performance enhancement through efficient database queries and caching strategies. The integration includes comprehensive error handling, rate limiting, and detailed logging for monitoring. Successfully reduced manual data entry processes by 70%, enabled real-time data synchronization across platforms, improved system reliability, and provided a foundation for future integrations and microservices architecture.`,
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
      console.error('Error generating content:', error);
      throw new Error('Failed to generate portfolio content');
    }
  }

  async generateContentFallback(parsedCV: ParsedCV): Promise<PortfolioContent> {
    // Generate initials from the full name
    const initials = parsedCV.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
      
    // Same prompt as main method but will use GPT-3.5
    const prompt = `Based on this person's CV information, create engaging web portfolio content.

Person's Information:
Name: ${parsedCV.fullName}
Title: ${parsedCV.title}
Skills: ${parsedCV.skills.map(s => s.name).join(', ')}
Experience: ${parsedCV.experience.map(e => `${e.position} at ${e.company}`).join(', ')}
Projects: ${parsedCV.projects?.map(p => `${p.name}: ${p.description}`).join(', ') || 'None listed'}

CRITICAL INSTRUCTIONS - FOLLOW WORD COUNTS EXACTLY:

1. smallIntro (EXACTLY 10-15 words - COUNT EVERY WORD)
   - Clear, professional tagline that captures expertise
   - Straightforward, no dramatic language
   - Example: "Full-stack developer specializing in React and Node.js applications" (8 words - ADD MORE)
   - MUST be between 10-15 words, not less, not more

2. about (EXACTLY 150-200 words - COUNT EVERY WORD)
   - Start with "Hello! I'm [name]..."
   - Write in first person
   - Conversational and genuine tone
   - Focus on: current role/studies, key achievements, passions, what drives them
   - Like introducing yourself to a colleague, not marketing copy
   - Avoid flowery language and clichés
   - MUST be between 150-200 words - if you write less than 150 words, ADD MORE CONTENT

3. enhancedProjects (EACH DESCRIPTION EXACTLY 130-150 words - COUNT EVERY SINGLE WORD)
   - If projects exist in CV: Expand each to EXACTLY 130-150 words
   - If no projects: Create exactly 3 realistic sample projects based on their skills
   - Each description must explain: what it does, technologies used, and impact/outcome
   - Be engaging and specific
   - Focus on problem solved, technologies used, and impact
   - WARNING: If any description is under 130 words, you FAILED the task
   - REQUIREMENT: Every project description must be AT LEAST 130 words and NO MORE than 150 words

WORD COUNT VERIFICATION:
- Count words in your response before submitting
- smallIntro: 10-15 words (count them!)
- about: 150-200 words (count them!)
- Each project description: 130-150 words (count them!)

Return in JSON format:
{
  "smallIntro": "EXACTLY 10-15 word professional tagline",
  "about": "EXACTLY 150-200 word about section starting with Hello! I'm...",
  "enhancedProjects": [
    {
      "name": "Project Name", 
      "description": "EXACTLY 130-150 word description explaining what it does, technologies used, and impact"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Using GPT-3.5 for faster fallback generation
          messages: [
            {
              role: 'system',
            content: 'You are a professional portfolio content writer. Your #1 priority is to follow word count limits EXACTLY. Count every single word before responding. If a section requires 130-150 words, it must have AT LEAST 130 words and NO MORE than 150 words. If you provide fewer words than requested, you have FAILED the task. Create engaging, authentic content that sounds natural and professional while strictly adhering to word count requirements.'
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
        const sampleProjects = generated.enhancedProjects?.slice(0, 3).map((project: any) => ({
          name: project.name,
          description: project.description,
          imageUrl: '', // Will be filled by user later
          githubUrl: '', // Will be filled by user later
          reportUrl: '' // Will be filled by user later
        })) || [];
          
        enhancedProjects.push(...sampleProjects);
        }

        return {
          ...parsedCV,
          initials,
        smallIntro: generated.smallIntro || `${parsedCV.title} with expertise in various technologies`,
        about: generated.about || `Hello! I'm ${parsedCV.fullName}, a passionate ${parsedCV.title} with experience in ${parsedCV.skills.slice(0, 3).map(s => s.name).join(', ')}.`,
          projects: enhancedProjects
        };
    } catch (error) {
      console.error('Error generating fallback content:', error);
      throw new Error('Failed to generate portfolio content with fallback model');
    }
  }
} 