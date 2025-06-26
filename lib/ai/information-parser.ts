import OpenAI from 'openai';

export interface ParsedCV {
  fullName: string;
  email: string;
  phone: string;
  title: string;
  skills: { name: string }[];
  experience: {
    company: string;
    position: string;
    duration: string;
    description: string;
  }[];
  education: {
    institution: string;
    degree: string;
    year: string;
  }[];
  projects?: {
    name: string;
    description: string;
  }[];
}

export class InformationParserAgent {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async parseCV(cvText: string): Promise<ParsedCV> {
    const prompt = `Extract the following information from this CV text. If any information is not found, use reasonable defaults or leave empty.

CV Text:
${cvText}

Extract and return in JSON format:
{
  "fullName": "person's full name",
  "email": "email address",
  "phone": "phone number",
  "title": "current job title or desired position",
  "skills": [{"name": "skill1"}, {"name": "skill2"}],
  "experience": [{
    "company": "company name",
    "position": "job title",
    "duration": "time period",
    "description": "what they did"
  }],
  "education": [{
    "institution": "school/university name",
    "degree": "degree obtained",
    "year": "graduation year"
  }],
  "projects": [{
    "name": "project name",
    "description": "what the project does"
  }]
}

CRITICAL RULES:
1. Skills Filtering:
   - Include ONLY technical skills (programming languages, frameworks, tools, technologies)
   - EXCLUDE all spoken languages (English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Greek, Russian, Dutch, Swedish, Polish, Turkish, Hebrew, etc.)
   - EXCLUDE soft skills (leadership, communication, teamwork, etc.)

2. Title Cleaning:
   - Remove "Intern" from any job titles automatically
   - Use core title only (e.g., "Software Developer" instead of "Software Developer Intern")
   - For the main title field, use their current/most recent position without "Intern"

3. Projects:
   - Extract actual projects if mentioned in the CV
   - Do NOT confuse work experience with projects
   - Projects should be things they built, not companies they worked at

Keep all extracted information accurate to the CV content.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a CV parser. Extract information and return only valid JSON. Follow the filtering rules strictly.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content || '{}';
      
      // Clean up the response to ensure valid JSON
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }

      return JSON.parse(jsonStr) as ParsedCV;
    } catch (error) {
      console.error('Error parsing CV:', error);
      throw new Error('Failed to parse CV information');
    }
  }
} 