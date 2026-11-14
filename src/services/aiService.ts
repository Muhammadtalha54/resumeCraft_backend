import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenerativeAI(apiKey);

export class AIService {
  /**
   * Analyze uploaded resume text and compute ATS score + recommendations.
   * If jobDescriptionText is provided, evaluates exact 1:1 keyword match % and gaps against the JD.
   */
  static async analyzeAndScoreResume(extractedText: string, targetStrategy: string = 'FAANG', jobDescriptionText?: string) {
    const jdClause = jobDescriptionText && jobDescriptionText.trim().length > 10
      ? `
Target Job Description:
"""
${jobDescriptionText.slice(0, 4000)}
"""
CRITICAL INSTRUCTION: Perform a strict 1:1 keyword alignment audit between candidate resume text and the Target Job Description.
Evaluate match percentage of essential technical skills, qualification prerequisites, and missing competencies.
`
      : `Market Strategy: ${targetStrategy}`;

    const prompt = `
You are an expert ATS (Applicant Tracking System) Auditor and Senior Career Coach.
Analyze the following resume text.
${jdClause}

Resume Content:
"""
${extractedText.slice(0, 7000)}
"""

Provide your evaluation strictly as a valid JSON object matching this schema:
{
  "overallAtsScore": number (0-100),
  "extractedTargetTitle": string (e.g. "Flutter Developer" or "Full Stack Engineer"),
  "scoreBreakdown": {
    "structure": number (0-100),
    "keywords": number (0-100),
    "impact": number (0-100),
    "readability": number (0-100)
  },
  "improvementSummary": [string array of 3-5 key observations],
  "missingSections": [string array of missing crucial resume sections or missing skills from JD],
  "actionVerbSuggestions": [string array of 4-6 recommended executive action verbs],
  "extractedStructuredResume": {
    "fullName": string,
    "email": string,
    "phone": string,
    "location": string,
    "summary": string,
    "skills": [string array],
    "experience": [
      {
        "role": string,
        "company": string,
        "period": string,
        "bulletPoints": [string array]
      }
    ],
    "education": [
      {
        "degree": string,
        "institution": string,
        "year": string
      }
    ],
    "projects": [
      {
        "title": string,
        "description": string,
        "technologies": [string array]
      }
    ]
  }
}
Respond with ONLY the JSON object, no markdown codeblock, no pre-amble.
`;

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY')) {
        return this.getMockAnalysis(extractedText);
      }

      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(prompt);

      const rawText = response.response.text() || '';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Gemini Analysis Error, falling back to mock:', error);
      return this.getMockAnalysis(extractedText);
    }
  }

  /**
   * Tailor resume content specifically for a given Job Description
   */
  static async tailorResumeToJob(extractedText: string, jobDescriptionText: string, targetStrategy: string = 'FAANG') {
    const prompt = `
You are an elite Resume Strategist specializing in ATS optimization.
Tailor the candidate's resume to match the target job description.

Candidate Resume Text:
"""
${extractedText.slice(0, 5000)}
"""

Target Job Description:
"""
${jobDescriptionText.slice(0, 4000)}
"""

Target Strategy: ${targetStrategy}

Instructions:
1. Identify keyword gaps between candidate experience and job description.
2. Rewrite professional summary and work experience bullet points using STAR method (Situation, Task, Action, Result) with strong action verbs.
3. Compute an improved ATS score leap.

Respond STRICTLY with a valid JSON object matching this schema:
{
  "previousAtsScore": number (e.g. 62),
  "newAtsScore": number (e.g. 94),
  "performanceBoostPercentage": number (e.g. 32),
  "improvementsMade": [
    "Replaced passive language with 12 high-impact executive verbs",
    "Optimized technical skills alignment for target role requirements",
    "Enhanced metrics and quantifiable achievements"
  ],
  "tailoredStructuredResume": {
    "fullName": string,
    "email": string,
    "phone": string,
    "location": string,
    "summary": string,
    "skills": [string array],
    "experience": [
      {
        "role": string,
        "company": string,
        "period": string,
        "bulletPoints": [string array]
      }
    ],
    "education": [
      {
        "degree": string,
        "institution": string,
        "year": string
      }
    ],
    "projects": [
      {
        "title": string,
        "description": string,
        "technologies": [string array]
      }
    ]
  }
}
Respond with ONLY JSON. No markdown codeblocks.
`;

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY')) {
        return this.getMockTailored(extractedText, jobDescriptionText);
      }

      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(prompt);

      const rawText = response.response.text() || '';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Gemini Tailoring Error, falling back to mock:', error);
      return this.getMockTailored(extractedText, jobDescriptionText);
    }
  }

  /**
   * Build an ATS-optimized professional resume from scratch based on manual step-by-step user input & target JD
   */
  static async buildResumeFromScratch(formData: {
    fullName: string;
    email: string;
    phone: string;
    location?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    targetJobTitle: string;
    jobDescriptionText: string;
    skills: string[];
    experiences: Array<{
      role: string;
      company: string;
      period: string;
      description?: string;
    }>;
    education: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
  }, targetStrategy: string = 'FAANG') {
    const prompt = `
You are an elite Executive Career Strategist and ATS Architect.
A candidate without an existing resume provided their raw career credentials.
Synthesize a world-class, ATS-compliant resume tailored specifically to the Target Job Description below using the "${targetStrategy}" strategy.

Candidate Input:
${JSON.stringify(formData, null, 2)}

Instructions:
1. Synthesize a compelling, tailored 3-line Professional Executive Summary targeting "${formData.targetJobTitle}".
2. For each experience entry, engineer 3-4 high-impact bullet points using the Google XYZ / STAR formula (Accomplished [X] as measured by [Y], by doing [Z]) with powerful action verbs.
3. Categorize and prioritize skills to match the requirements of the job description.
4. Estimate an expected ATS match score (typically 88-96 for tailored input).

Respond STRICTLY with a valid JSON object matching this schema:
{
  "atsScore": number (85-98),
  "extractedTargetTitle": string,
  "summary": string,
  "improvementSummary": [string array of 3-4 strategic optimizations made],
  "tailoredStructuredResume": {
    "fullName": string,
    "email": string,
    "phone": string,
    "location": string,
    "linkedinUrl": string,
    "portfolioUrl": string,
    "summary": string,
    "skills": [string array],
    "experience": [
      {
        "role": string,
        "company": string,
        "period": string,
        "bulletPoints": [string array]
      }
    ],
    "education": [
      {
        "degree": string,
        "institution": string,
        "year": string
      }
    ],
    "projects": [
      {
        "title": string,
        "description": string,
        "technologies": [string array]
      }
    ]
  }
}
Respond with ONLY JSON. No markdown codeblocks.
`;

    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY')) {
        return this.getMockFromScratch(formData);
      }

      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(prompt);

      const rawText = response.response.text() || '';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Gemini Build From Scratch Error, falling back to mock:', error);
      return this.getMockFromScratch(formData);
    }
  }

  /**
   * Fallback mock for development testing when API Key is pending
   */
  private static getMockAnalysis(text: string) {
    return {
      overallAtsScore: 68,
      extractedTargetTitle: "Flutter Developer",
      scoreBreakdown: {
        structure: 80,
        keywords: 60,
        impact: 65,
        readability: 70
      },
      improvementSummary: [
        "Include more quantifiable metrics (%, $, scale) in experience bullet points.",
        "Add strong action verbs such as 'Architected', 'Spearheaded', and 'Optimized'.",
        "Align technical skills keywords directly with industry standards."
      ],
      missingSections: ["Certifications & Professional Training"],
      actionVerbSuggestions: ["Architected", "Engineered", "Orchestrated", "Accelerated"],
      extractedStructuredResume: {
        fullName: "Candidate Name",
        email: "candidate@example.com",
        phone: "+1 (555) 019-2831",
        location: "Bahawalnagar, Pakistan",
        summary: "Motivated Software Engineer with hands-on experience in full-stack web and mobile application development.",
        skills: ["Flutter", "Dart", "Node.js", "TypeScript", "PostgreSQL", "Git", "REST APIs"],
        experience: [
          {
            role: "Software Developer Intern",
            company: "Tech Solutions Inc.",
            period: "2023 - Present",
            bulletPoints: [
              "Engineered responsive cross-platform mobile screens using Flutter and Riverpod.",
              "Integrated RESTful API endpoints resulting in 25% faster data sync.",
              "Collaborated in Agile sprint cycles delivering modular UI components."
            ]
          }
        ],
        education: [
          {
            degree: "BS Software Engineering",
            institution: "The Islamia University of Bahawalpur",
            year: "2023 - 2027"
          }
        ],
        projects: [
          {
            title: "ResumeCraft AI",
            description: "AI-Powered Resume Analysis and Career Optimization System.",
            technologies: ["Flutter", "Node.js", "Express", "Prisma", "Google Gemini API"]
          }
        ]
      }
    };
  }

  private static getMockTailored(text: string, jd: string) {
    const base = this.getMockAnalysis(text);
    return {
      previousAtsScore: 68,
      newAtsScore: 94,
      performanceBoostPercentage: 38,
      improvementsMade: [
        "Replaced 8 passive phrases with high-impact executive verbs",
        "Tailored technical skill section to match target job requirements",
        "Formatted experience bullet points using STAR methodology"
      ],
      tailoredStructuredResume: {
        ...base.extractedStructuredResume,
        summary: `Results-driven Professional tailored for target position. Demonstrated experience delivering high impact systems aligned with target requirements.`
      }
    };
  }

  private static getMockFromScratch(data: any) {
    return {
      atsScore: 92,
      extractedTargetTitle: data.targetJobTitle || 'Software Engineer',
      summary: `Results-driven ${data.targetJobTitle || 'Software Engineer'} specializing in high-performance digital architectures and modern software delivery.`,
      improvementSummary: [
        "Synthesized executive professional summary targeted to job requirements",
        "Formulated quantified impact bullet points using STAR formula",
        "Harmonized skill keywords with ATS candidate filters"
      ],
      tailoredStructuredResume: {
        fullName: data.fullName || 'Candidate Name',
        email: data.email || 'candidate@example.com',
        phone: data.phone || '+1 (555) 019-2831',
        location: data.location || 'Remote',
        linkedinUrl: data.linkedinUrl || '',
        portfolioUrl: data.portfolioUrl || '',
        summary: `Results-driven ${data.targetJobTitle || 'Software Engineer'} with demonstrated ability in delivering scalable, reliable solutions. Proven record of optimizing engineering lifecycles and driving cross-functional project success.`,
        skills: data.skills && data.skills.length > 0 ? data.skills : ['Dart', 'Flutter', 'TypeScript', 'Node.js', 'REST APIs', 'Git'],
        experience: data.experiences && data.experiences.length > 0
          ? data.experiences.map((exp: any) => ({
              role: exp.role || 'Software Engineer',
              company: exp.company || 'Tech Company',
              period: exp.period || '2023 - Present',
              bulletPoints: [
                `Architected core functional modules for ${exp.company || 'enterprise platforms'}, enhancing throughput and system reliability.`,
                `Led engineering deliverables aligning with Agile sprints, reducing release turnaround times by 20%.`,
                `Collaborated across design and backend teams to implement high-availability features.`
              ]
            }))
          : [
              {
                role: data.targetJobTitle || 'Software Developer',
                company: 'InnovateX Solutions',
                period: '2023 - Present',
                bulletPoints: [
                  'Designed and deployed responsive mobile and cloud-connected service components.',
                  'Refactored asynchronous network data pipelines achieving 30% latency reduction.'
                ]
              }
            ],
        education: data.education && data.education.length > 0
          ? data.education
          : [
              {
                degree: 'Bachelor of Science in Software Engineering',
                institution: 'State University of Technology',
                year: '2024'
              }
            ],
        projects: [
          {
            title: `${data.targetJobTitle || 'Career'} Portfolio Project`,
            description: 'Scalable production application built using modern software design principles.',
            technologies: data.skills && data.skills.length > 0 ? data.skills.slice(0, 4) : ['Flutter', 'Node.js', 'PostgreSQL']
          }
        ]
      }
    };
  }
}
