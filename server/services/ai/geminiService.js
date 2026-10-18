import { GoogleGenAI } from '@google/genai';


/*
|--------------------------------------------------------------------------
| Gemini Configuration
|--------------------------------------------------------------------------
*/

const GEMINI_MODEL = 'gemini-3.8-flash';


/*
|--------------------------------------------------------------------------
| Gemini Client
|--------------------------------------------------------------------------
*/

const getApiKey = () => {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
};


const getGeminiClient = () => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
  });
};


/*
|--------------------------------------------------------------------------
| Gemini Request / Quota Protection
|--------------------------------------------------------------------------
|
| Important:
| - Never automatically retry 429 quota errors.
| - Once Gemini reports quota exhaustion, temporarily stop sending requests.
| - This prevents repeated failed requests and unnecessary waiting.
|
|--------------------------------------------------------------------------
*/

let geminiCooldownUntil = 0;

const GEMINI_COOLDOWN_MS = 5 * 60 * 1000;

const isGeminiInCooldown = () => {
  return Date.now() < geminiCooldownUntil;
};


const activateGeminiCooldown = (
  milliseconds = GEMINI_COOLDOWN_MS
) => {
  geminiCooldownUntil =
    Date.now() + milliseconds;

  const minutes = Math.ceil(
    milliseconds / 60000
  );

  console.warn(
    `⏳ Gemini cooldown activated for ${minutes} minute(s).`
  );
};


/*
|--------------------------------------------------------------------------
| Low-Level Gemini Request
|--------------------------------------------------------------------------
|
| This is the ONLY function in this file that directly calls:
|
| client.models.generateContent()
|
|--------------------------------------------------------------------------
*/

const requestGeminiText = async (prompt) => {
  /*
  |--------------------------------------------------------------------------
  | Cooldown
  |--------------------------------------------------------------------------
  */

  if (isGeminiInCooldown()) {
    const remainingMs =
      geminiCooldownUntil - Date.now();

    const remainingMinutes = Math.ceil(
      remainingMs / 60000
    );

    console.warn(
      `⏭️ Gemini request skipped. Cooldown active for approximately ${remainingMinutes} minute(s).`
    );

    return {
      text: null,
      errorType: 'COOLDOWN',
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Client
  |--------------------------------------------------------------------------
  */

  const client = getGeminiClient();

  if (!client) {
    console.warn(
      '⚠️ Gemini unavailable: GEMINI_API_KEY is missing.'
    );

    return {
      text: null,
      errorType: 'NO_API_KEY',
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Prompt validation
  |--------------------------------------------------------------------------
  */

  if (
    !prompt ||
    !String(prompt).trim()
  ) {
    console.warn(
      '⚠️ Gemini request skipped: empty prompt.'
    );

    return {
      text: null,
      errorType: 'EMPTY_PROMPT',
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Request
  |--------------------------------------------------------------------------
  */

  try {
    console.log(
      `🤖 Sending request to Gemini (${GEMINI_MODEL})...`
    );

    const timeoutMs = 30000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini request timed out after 30s')), timeoutMs)
    );

    const response = await Promise.race([
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents: String(prompt),
        config: {
          thinkingConfig: {
            thinkingLevel: 'low',
          },
        },
      }),
      timeoutPromise,
    ]);


    const rawText =
      response?.text?.trim();


    /*
    |--------------------------------------------------------------------------
    | Empty response
    |--------------------------------------------------------------------------
    */

    if (!rawText) {
      console.warn(
        '⚠️ Gemini returned an empty response.'
      );

      return {
        text: null,
        errorType: 'EMPTY_RESPONSE',
      };
    }

    const text = rawText
      .replace(/\*\*\s*\*\*/g, '')
      .replace(/\*{3,}/g, '')
      .trim();

    console.log(
      '✅ Gemini response received.'
    );

    return {
      text,
      errorType: null,
    };

  } catch (error) {
    const status =
      error?.status ||
      error?.code ||
      error?.response?.status;

    const message =
      error?.message ||
      String(error || '');


    let errorType = 'API_ERROR';


    /*
    |--------------------------------------------------------------------------
    | 429 / Quota
    |--------------------------------------------------------------------------
    */

    if (
      status === 429 ||
      /RESOURCE_EXHAUSTED|quota exceeded|quota|rate limit/i.test(
        message
      )
    ) {
      errorType = 'QUOTA';

      activateGeminiCooldown(
        30 * 1000 // Reduced from 5 minutes to 30 seconds
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 503 / Temporary availability
    |--------------------------------------------------------------------------
    */

    else if (
      status === 503 ||
      /UNAVAILABLE|overloaded|high demand|temporarily unavailable/i.test(
        message
      )
    ) {
      errorType = 'UNAVAILABLE';

      activateGeminiCooldown(
        5 * 1000 // Reduced from 2 minutes to 5 seconds
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Authentication / API key
    |--------------------------------------------------------------------------
    */

    else if (
      status === 401 ||
      status === 403 ||
      /api key|authentication|permission|forbidden/i.test(
        message
      )
    ) {
      errorType = 'AUTH';
    }


    /*
    |--------------------------------------------------------------------------
    | Log error
    |--------------------------------------------------------------------------
    */

    console.error(
      `❌ Gemini ${errorType}:`,
      message
    );


    return {
      text: null,
      errorType,
    };
  }
};


/*
|--------------------------------------------------------------------------
| Public Gemini Text Helper
|--------------------------------------------------------------------------
*/

export const generateGeminiText = async (
  prompt
) => {
  const result =
    await requestGeminiText(prompt);

  return result.text;
};


/*
|--------------------------------------------------------------------------
| Repository Facts
|--------------------------------------------------------------------------
*/

const getRepoFacts = (repo) => {
  const languages =
    Array.isArray(repo?.languages)
      ? repo.languages
          .map((language) => {
            if (
              typeof language === 'string'
            ) {
              return language;
            }

            return language?.name;
          })
          .filter(Boolean)
          .join(', ')
      : 'Unknown';


  const runtimeDependencies =
    repo?.dependencies?.runtime || [];


  const dependencyNames =
    Array.isArray(runtimeDependencies)
      ? runtimeDependencies
          .map((dependency) => {
            if (
              typeof dependency === 'string'
            ) {
              return dependency;
            }

            return dependency?.name;
          })
          .filter(Boolean)
          .slice(0, 30)
          .join(', ')
      : 'None detected';


  const fileTree =
    Array.isArray(repo?.structure?.fileTree)
      ? repo.structure.fileTree
      : [];


  const files =
    fileTree.filter(
      (item) =>
        item?.type === 'blob'
    );


  const directories =
    fileTree.filter(
      (item) =>
        item?.type === 'tree'
    );


  const keyDirectories =
    Array.isArray(
      repo?.structure?.keyDirectories
    )
      ? repo.structure.keyDirectories.join(
          ', '
        )
      : directories
          .slice(0, 20)
          .map(
            (directory) =>
              directory?.path
          )
          .filter(Boolean)
          .join(', ');


  return {
    fullName:
      repo?.fullName ||
      'Unknown repository',

    description:
      repo?.description ||
      'No repository description available.',

    primaryLanguage:
      repo?.primaryLanguage ||
      'Unknown',

    languages:
      languages || 'Unknown',

    keyDirectories:
      keyDirectories ||
      'No directory information available.',

    totalFiles:
      files.length,

    totalDirs:
      directories.length,

    dependencies:
      dependencyNames ||
      'None detected',

    packageManager:
      repo?.packageManager ||
      'Unknown',
  };
};


/*
|--------------------------------------------------------------------------
| Deterministic Fallback Summary
|--------------------------------------------------------------------------
*/

const buildFallbackSummary = (
  repo,
  analysis
) => {
  const facts =
    getRepoFacts(repo);


  const score =
    analysis?.healthScore;


  const langText = facts.primaryLanguage && facts.primaryLanguage !== 'Unknown'
    ? `built primarily with **${facts.primaryLanguage}**`
    : 'with multi-language support';

  let summary =
    `**${facts.fullName}** is a repository ${langText}. `;

  if (facts.languages && facts.languages !== 'Unknown') {
    summary +=
      `The detected languages include ${facts.languages}. `;
  }

  if (facts.description && facts.description !== 'No repository description available.') {
    summary +=
      `The repository is described as: ${facts.description}`;
  }


  if (
    typeof score === 'number'
  ) {
    summary +=
      `\n\nThe current deterministic health score is **${score}/100**.`;
  }


  return summary.replace(/\*\*\s*\*\*/g, '').trim();
};


/*
|--------------------------------------------------------------------------
| Deterministic Fallback Recommendations
|--------------------------------------------------------------------------
*/

const buildFallbackRecommendations = (
  repo,
  analysis
) => {
  const recommendations = [];

  const findings =
    Array.isArray(analysis?.findings)
      ? analysis.findings
      : [];


  findings
    .slice(0, 5)
    .forEach((finding) => {
      if (finding?.message) {
        recommendations.push(
          finding.message
        );
      }
    });


  if (
    recommendations.length < 4
  ) {
    recommendations.push(
      'Review authentication and authorization boundaries for protected functionality.'
    );
  }


  if (
    recommendations.length < 4
  ) {
    recommendations.push(
      'Keep route and controller responsibilities separated to improve maintainability.'
    );
  }


  if (
    recommendations.length < 4
  ) {
    recommendations.push(
      'Keep README documentation synchronized with the current implementation.'
    );
  }


  if (
    recommendations.length < 4
  ) {
    recommendations.push(
      'Review error handling and input validation across API endpoints.'
    );
  }


  return recommendations.slice(
    0,
    5
  );
};


/*
|--------------------------------------------------------------------------
| Deterministic Onboarding
|--------------------------------------------------------------------------
*/

const buildFallbackOnboarding = (
  repo
) => {
  const facts =
    getRepoFacts(repo);


  return {
    overview:
      facts.description,

    techStack:
      `Primary language: ${facts.primaryLanguage}. Languages: ${facts.languages}. Dependencies: ${facts.dependencies}.`,

    architecture:
      `The repository contains ${facts.totalFiles} detected files and ${facts.totalDirs} detected directories. Key directories: ${facts.keyDirectories}.`,

    keyDirectories:
      Array.isArray(
        repo?.structure?.keyDirectories
      )
        ? repo.structure.keyDirectories
        : [],

    gettingStarted:
      'Review the README and package configuration first, then inspect the main application entry points, routes, controllers, models, and frontend pages.',
  };
};


/*
|--------------------------------------------------------------------------
| Combined Repository AI Insights
|--------------------------------------------------------------------------
|
| ONE Gemini request for:
| - Summary
| - Recommendations
| - Onboarding
|
|--------------------------------------------------------------------------
*/

export const generateRepositoryInsights = async (
  repo,
  analysis
) => {
  const facts =
    getRepoFacts(repo);


  const findings =
    (analysis?.findings || [])
      .slice(0, 8)
      .map(
        (finding) =>
          `- [${String(
            finding.severity ||
              'info'
          ).toUpperCase()}] ${
            finding.file ||
            'General'
          }: ${
            finding.message || ''
          }`
      )
      .join('\n');


  const prompt = `You are GitInsight AI analyzing a GitHub repository.

Use ONLY the factual repository data below.

Do not invent files, features, commands, dependencies, vulnerabilities, or architecture.

REPOSITORY

Repository: ${facts.fullName}
Description: ${facts.description}
Primary language: ${facts.primaryLanguage}
Languages: ${facts.languages}
Key directories: ${facts.keyDirectories}
Total files: ${facts.totalFiles}
Total directories: ${facts.totalDirs}
Runtime dependencies: ${facts.dependencies}
Package manager: ${facts.packageManager}
Health score: ${
    analysis?.healthScore ??
    'Unknown'
  }/100

STATIC FINDINGS

${findings || 'No findings.'}

Return ONLY valid JSON with exactly these keys:

{
  "summary": "2 short paragraphs",
  "recommendations": [
    "recommendation 1",
    "recommendation 2",
    "recommendation 3",
    "recommendation 4"
  ],
  "onboarding": {
    "overview": "...",
    "techStack": "...",
    "architecture": "...",
    "keyDirectories": ["..."],
    "gettingStarted": "..."
  }
}`;


  const result =
    await requestGeminiText(
      prompt
    );


  if (result.text) {
    try {
      const cleaned =
        result.text
          .replace(
            /```json/gi,
            ''
          )
          .replace(
            /```/g,
            ''
          )
          .trim();


      const parsed =
        JSON.parse(cleaned);


      if (
        parsed?.summary &&
        Array.isArray(
          parsed.recommendations
        ) &&
        parsed?.onboarding
      ) {
        const cleanStr = (s) =>
          typeof s === 'string'
            ? s.replace(/\*\*\s*\*\*/g, '').replace(/\*{3,}/g, '').trim()
            : s;

        return {
          aiSummary:
            cleanStr(parsed.summary),

          aiRecommendations:
            parsed.recommendations
              .map(cleanStr)
              .filter(Boolean)
              .slice(0, 5),

          aiOnboarding: {
            ...buildFallbackOnboarding(
              repo
            ),

            ...parsed.onboarding,

            overview: cleanStr(parsed.onboarding?.overview),
            techStack: cleanStr(parsed.onboarding?.techStack),
            architecture: cleanStr(parsed.onboarding?.architecture),

            keyDirectories:
              Array.isArray(
                parsed.onboarding
                  .keyDirectories
              )
                ? parsed.onboarding
                    .keyDirectories
                : repo.structure
                    ?.keyDirectories ||
                  [],
          },

          source: 'gemini',
          errorType: null,
        };
      }


      console.warn(
        '⚠️ Gemini returned JSON with an unexpected structure.'
      );

    } catch (error) {
      console.warn(
        '⚠️ Could not parse combined Gemini insights:',
        error.message
      );
    }
  }


  return {
    aiSummary:
      buildFallbackSummary(
        repo,
        analysis
      ),

    aiRecommendations:
      buildFallbackRecommendations(
        repo,
        analysis
      ),

    aiOnboarding:
      buildFallbackOnboarding(
        repo
      ),

    source: 'fallback',
    errorType:
      result.errorType,
  };
};


/*
|--------------------------------------------------------------------------
| Repository Chat Fallback
|--------------------------------------------------------------------------
*/

const buildGroundedChatFallback = (
  repo,
  question,
  context
) => {
  const repoName =
    repo?.fullName ||
    repo?.name ||
    'this repository';


  if (
    !context ||
    !String(context).trim()
  ) {
    return `I couldn't find enough relevant information in **${repoName}** to answer that question confidently.

Try asking about a specific file, technology, dependency, route, component, or feature.`;
  }


  return `I couldn't use Gemini right now, so I'm answering from the repository's indexed code.

### Repository Context

${context}

### Question

${question}

The information above comes directly from the repository context retrieved for this question.`;
};


/*
|--------------------------------------------------------------------------
| Repository Chat / RAG
|--------------------------------------------------------------------------
*/

export const generateRepositoryChat = async (
  repo,
  question,
  context
) => {
  const prompt = `You are GitInsight AI, an assistant that answers questions about a GitHub repository.

IMPORTANT RULES:

1. Use ONLY the repository context provided below.
2. Do NOT invent files, features, technologies, dependencies, routes, functions, or behavior.
3. If the context does not contain enough information, clearly say so.
4. Mention relevant file paths when they appear in the context.
5. Give a clear and practical answer.
6. Use Markdown.
7. Do not claim that something exists unless the provided context supports it.

REPOSITORY:
${
    repo?.fullName ||
    repo?.name ||
    'Unknown repository'
  }

QUESTION:
${question}

REPOSITORY CONTEXT:
${
    context ||
    'No relevant repository context was found.'
  }

Answer the question using only the repository context above.`;


  const result =
    await requestGeminiText(
      prompt
    );


  if (result.text) {
    return {
      answer:
        result.text,

      source: 'gemini',

      errorType: null,
    };
  }


  return {
    answer:
      buildGroundedChatFallback(
        repo,
        question,
        context
      ),

    source: 'fallback',

    errorType:
      result.errorType,
  };
};


/*
|--------------------------------------------------------------------------
| Compatibility Helpers
|--------------------------------------------------------------------------
*/

export const generateRepositorySummary =
  async (
    repo,
    analysis
  ) => {
    const result =
      await generateRepositoryInsights(
        repo,
        analysis
      );

    return result.aiSummary;
  };


export const generateRecommendations =
  async (
    repo,
    analysis
  ) => {
    const result =
      await generateRepositoryInsights(
        repo,
        analysis
      );

    return result.aiRecommendations;
  };


export const generateOnboardingGuide =
  async (
    repo
  ) => {
    return buildFallbackOnboarding(
      repo
    );
  };