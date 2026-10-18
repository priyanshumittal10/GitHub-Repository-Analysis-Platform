import axios from 'axios';

import RepositoryChunk from '../../models/RepositoryChunk.js';
import {
  generateRepositoryChat,
  generateGeminiText,
} from '../ai/geminiService.js';


/*
|--------------------------------------------------------------------------
| GitHub Client
|--------------------------------------------------------------------------
*/

const getGitHubClient = () => {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitInsight-Platform/1.0',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return axios.create({
    baseURL: 'https://api.github.com',
    headers,
    timeout: 15000,
  });
};


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();


const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanEmptyAsterisks = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(/\*\*\s*\*\*/g, '').replace(/\*{3,}/g, '');
};


/*
|--------------------------------------------------------------------------
| Search Terms
|--------------------------------------------------------------------------
*/

const STOP_WORDS = new Set([
  'how',
  'does',
  'what',
  'where',
  'when',
  'why',
  'which',
  'who',
  'is',
  'are',
  'was',
  'were',
  'the',
  'this',
  'that',
  'these',
  'those',
  'of',
  'in',
  'on',
  'for',
  'to',
  'and',
  'or',
  'a',
  'an',
  'my',
  'your',
  'their',
  'our',
  'project',
  'implemented',
  'work',
]);


const getSearchTerms = (query) =>
  normalizeText(query)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word)
    );


/*
|--------------------------------------------------------------------------
| Query Intent
|--------------------------------------------------------------------------
*/

const detectQueryIntent = (question = '') => {
  const q = String(question).toLowerCase();

  if (
    /authentication|auth|jwt|json web token|login|logout|register|signup|sign in|sign up|token|password|protected route|authorization|rbac|role based/i.test(
      q
    )
  ) {
    return 'authentication';
  }

  if (
    /route|routing|endpoint|api|url|navigate|navigation|router/i.test(q)
  ) {
    return 'routing';
  }

  if (
    /error|exception|validation|handle error|error handling/i.test(q)
  ) {
    return 'error-handling';
  }

  if (
    /database|mongodb|mongoose|schema|model|collection|query/i.test(q)
  ) {
    return 'database';
  }

  if (
    /frontend|react|component|jsx|ui|page|client/i.test(q)
  ) {
    return 'frontend';
  }

  if (
    /backend|server|express|controller|middleware/i.test(q)
  ) {
    return 'backend';
  }

  if (
    /dependency|dependencies|package|library|npm/i.test(q)
  ) {
    return 'dependencies';
  }

  if (
    /architecture|structure|workflow|flow|organized/i.test(q)
  ) {
    return 'architecture';
  }

  if (
    /readme|documentation|setup|install|run/i.test(q)
  ) {
    return 'documentation';
  }

  return 'general';
};


/*
|--------------------------------------------------------------------------
| File Priority
|--------------------------------------------------------------------------
*/

const getFilePriority = (filePath = '') => {
  const path = String(filePath).toLowerCase();

  let score = 0;

  // Documentation / project metadata
  if (path === 'readme.md') {
    score += 100;
  }

  if (path.endsWith('package.json')) {
    score += 95;
  }

  // Authentication
  if (
    /auth|login|logout|register|signup|signin|jwt|token|password/i.test(
      path
    )
  ) {
    score += 90;
  }

  // Backend
  if (/server|backend|api/i.test(path)) {
    score += 65;
  }

  if (
    /controllers?|routes?|middleware|services?|models?|config|utils?/i.test(
      path
    )
  ) {
    score += 60;
  }

  // Main application files
  if (
    /(^|\/)(app|server|index|main)\.[jt]sx?$/.test(path)
  ) {
    score += 55;
  }

  // Frontend
  if (/client|src/i.test(path)) {
    score += 35;
  }

  if (
    /components?|pages?|hooks?|context|store/i.test(path)
  ) {
    score += 30;
  }

  // Configuration
  if (
    /config|env|vite|webpack|eslint/i.test(path)
  ) {
    score += 25;
  }

  return score;
};


/*
|--------------------------------------------------------------------------
| Index Repository
|--------------------------------------------------------------------------
*/

export const indexRepositoryFiles = async (repo) => {
  const client = getGitHubClient();

  const fileTree = Array.isArray(repo.structure?.fileTree)
    ? repo.structure.fileTree
    : [];

  /*
  |--------------------------------------------------------------------------
  | Select valid source files
  |--------------------------------------------------------------------------
  */

  const supportedFiles = fileTree
    .filter((file) => {
      return (
        file &&
        file.type === 'blob' &&
        typeof file.path === 'string' &&
        file.path.trim().length > 0
      );
    })
    .filter((file) => {
      const path = file.path.toLowerCase();

      return (
        /\.(js|jsx|ts|tsx|json|md|mjs|cjs)$/.test(path) &&
        !/node_modules|dist|build|coverage|\.git\//.test(path)
      );
    });

  /*
  |--------------------------------------------------------------------------
  | Rank important files
  |--------------------------------------------------------------------------
  */

  const targetFiles = [...supportedFiles]
    .sort((a, b) => {
      const aPath = a?.path || '';
      const bPath = b?.path || '';

      const priorityDiff =
        getFilePriority(bPath) -
        getFilePriority(aPath);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return aPath.localeCompare(bPath);
    })
    .slice(0, 30);

  console.log(
    `📂 Found ${supportedFiles.length} supported files. Selecting ${targetFiles.length} important files.`
  );

  const newChunks = [];
  let successfullyIndexedFiles = 0;

  /*
  |--------------------------------------------------------------------------
  | Fetch selected files
  |--------------------------------------------------------------------------
  */

  for (const file of targetFiles) {
    const filePath = file?.path;

    if (!filePath) {
      continue;
    }

    try {
      console.log(`📄 Fetching: ${filePath}`);

      const response = await client.get(
        `/repos/${repo.owner}/${repo.name}/contents/${filePath}`
      );

      const data = response?.data;

      /*
      |--------------------------------------------------------------------------
      | GitHub content validation
      |--------------------------------------------------------------------------
      */

      if (!data) {
        console.warn(
          `⚠️ No GitHub response data for ${filePath}`
        );
        continue;
      }

      if (Array.isArray(data)) {
        console.warn(
          `⚠️ Skipping directory response: ${filePath}`
        );
        continue;
      }

      if (
        typeof data.content !== 'string' ||
        !data.content.trim()
      ) {
        console.warn(
          `⚠️ No usable content returned for ${filePath}`
        );
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | Decode Base64 content
      |--------------------------------------------------------------------------
      */

      let text;

      try {
        text = Buffer.from(
          data.content.replace(/\s/g, ''),
          'base64'
        ).toString('utf8');
      } catch (decodeError) {
        console.warn(
          `⚠️ Could not decode ${filePath}:`,
          decodeError.message
        );
        continue;
      }

      if (
        typeof text !== 'string' ||
        !text.trim()
      ) {
        console.warn(
          `⚠️ Empty decoded content for ${filePath}`
        );
        continue;
      }

      const lines = text.split('\n');

      /*
      |--------------------------------------------------------------------------
      | Create chunks
      |--------------------------------------------------------------------------
      */

      const chunkSize = 45;
      const overlap = 8;
      const step = chunkSize - overlap;

      let fileCreatedChunks = 0;

      for (
        let i = 0;
        i < lines.length;
        i += step
      ) {
        const slice = lines.slice(
          i,
          i + chunkSize
        );

        if (!slice.length) {
          break;
        }

        const chunkContent = slice.join('\n');

        if (
          typeof chunkContent !== 'string' ||
          !chunkContent.trim()
        ) {
          continue;
        }

        const keywords = Array.from(
          new Set(
            normalizeText(chunkContent)
              .split(/\s+/)
              .filter((word) => word.length > 2)
          )
        ).slice(0, 50);

        newChunks.push({
          repositoryId: repo._id,
          filePath,
          startLine: i + 1,
          endLine: i + slice.length,
          content: chunkContent,
          keywords,
        });

        fileCreatedChunks++;
      }

      if (fileCreatedChunks > 0) {
        successfullyIndexedFiles++;

        console.log(
          `   ✅ ${filePath} → ${fileCreatedChunks} chunk(s)`
        );
      } else {
        console.warn(
          `   ⚠️ ${filePath} produced no chunks`
        );
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not fetch content for ${filePath}:`,
        error.response?.data?.message ||
          error.message
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | README fallback
  |--------------------------------------------------------------------------
  */

  if (
    newChunks.length === 0 &&
    typeof repo.readme?.content === 'string' &&
    repo.readme.content.trim()
  ) {
    const readmeContent =
      repo.readme.content.slice(0, 8000);

    const lines = readmeContent.split('\n');

    if (readmeContent.trim()) {
      newChunks.push({
        repositoryId: repo._id,
        filePath: 'README.md',
        startLine: 1,
        endLine: lines.length,
        content: readmeContent,
        keywords: [
          'readme',
          'project',
          'architecture',
          'features',
          'routing',
          'authentication',
          'middleware',
        ],
      });

      console.log(
        '📖 Used stored README as indexing fallback.'
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Replace old chunks
  |--------------------------------------------------------------------------
  */

  await RepositoryChunk.deleteMany({
    repositoryId: repo._id,
  });

  /*
  |--------------------------------------------------------------------------
  | Final validation before MongoDB
  |--------------------------------------------------------------------------
  */

  const validChunks = newChunks.filter((chunk) => {
    return (
      chunk &&
      chunk.repositoryId &&
      typeof chunk.filePath === 'string' &&
      chunk.filePath.trim() &&
      typeof chunk.content === 'string' &&
      chunk.content.trim()
    );
  });

  if (validChunks.length > 0) {
    await RepositoryChunk.insertMany(validChunks);
  }

  console.log(
    `📚 Indexed ${validChunks.length} chunks from ${successfullyIndexedFiles} files for ${repo.fullName}`
  );

  console.log(
    '📁 Indexed files:',
    targetFiles
      .filter((file) =>
        validChunks.some(
          (chunk) => chunk.filePath === file.path
        )
      )
      .map((file) => file.path)
  );

  return {
    indexedFilesCount: successfullyIndexedFiles,
    chunksCreated: validChunks.length,
  };
};


/*
|--------------------------------------------------------------------------
| Retrieval
|--------------------------------------------------------------------------
*/

export const retrieveChunks = async (
  repositoryId,
  query
) => {
  const allChunks = await RepositoryChunk.find({
    repositoryId,
  }).lean();

  if (!allChunks.length) {
    return [];
  }

  const intent = detectQueryIntent(query);
  const searchTerms = getSearchTerms(query);

  console.log('🔎 Query intent:', intent);
  console.log('🔎 Search terms:', searchTerms);

  const scored = allChunks.map((chunk) => {
    let score = 0;

    const lowerPath =
      String(chunk.filePath || '').toLowerCase();

    const lowerContent =
      String(chunk.content || '').toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Generic term matching
    |--------------------------------------------------------------------------
    */

    for (const term of searchTerms) {
      if (lowerPath.includes(term)) {
        score += 8;
      }

      if (chunk.keywords?.includes(term)) {
        score += 4;
      }

      const regex = new RegExp(
        escapeRegex(term),
        'gi'
      );

      const count =
        (lowerContent.match(regex) || []).length;

      score += Math.min(count * 2, 12);
    }

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    */

    if (intent === 'authentication') {
      if (
        /auth|login|logout|register|signup|signin|jwt|token|password/i.test(
          lowerPath
        )
      ) {
        score += 35;
      }

      if (
        /jwt|token|authenticate|authorization|password|bcrypt|login|logout|register|protected|middleware|role/i.test(
          lowerContent
        )
      ) {
        score += 20;
      }

      if (
        /server|backend|middleware|controllers?|routes?|services?|models?/i.test(
          lowerPath
        )
      ) {
        score += 25;
      }

      if (
        /client|frontend/i.test(lowerPath)
      ) {
        score += 5;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Routing
    |--------------------------------------------------------------------------
    */

    if (intent === 'routing') {
      if (
        /server[\/\\]server\.[jt]sx?$/i.test(
          lowerPath
        )
      ) {
        score += 50;
      }

      if (
        /routes?|router/i.test(lowerPath)
      ) {
        score += 30;
      }

      if (
        /protectedroute/i.test(lowerPath)
      ) {
        score += 5;
      }

      if (
        /router|route|navigate|endpoint|app\.use|express\.router|router\.(get|post|put|patch|delete)/i.test(
          lowerContent
        )
      ) {
        score += 25;
      }

      if (
        /server|backend|api|controllers?|middleware/i.test(
          lowerPath
        )
      ) {
        score += 10;
      }

      if (
        /client|src|pages?|components?/i.test(
          lowerPath
        )
      ) {
        score += 2;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Error Handling
    |--------------------------------------------------------------------------
    */

    if (intent === 'error-handling') {
      if (
        /error|middleware|server|controller|service/i.test(
          lowerPath
        )
      ) {
        score += 25;
      }

      if (
        /try|catch|next\s*\(|next\(error\)|errorhandler|error-handler|res\.status|throw new error|console\.error/i.test(
          lowerContent
        )
      ) {
        score += 25;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Database
    |--------------------------------------------------------------------------
    */

    if (intent === 'database') {
      if (
        /models?|schema|database|db/i.test(
          lowerPath
        )
      ) {
        score += 35;
      }

      if (
        /mongoose|mongodb|schema|model|collection/i.test(
          lowerContent
        )
      ) {
        score += 20;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Backend
    |--------------------------------------------------------------------------
    */

    if (intent === 'backend') {
      if (
        /server|backend|controllers?|routes?|middleware|services?/i.test(
          lowerPath
        )
      ) {
        score += 30;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Frontend
    |--------------------------------------------------------------------------
    */

    if (intent === 'frontend') {
      if (
        /client|src|components?|pages?|hooks?/i.test(
          lowerPath
        )
      ) {
        score += 25;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Documentation
    |--------------------------------------------------------------------------
    */

    if (intent === 'documentation') {
      if (
        /readme|docs/i.test(lowerPath)
      ) {
        score += 30;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Important application files
    |--------------------------------------------------------------------------
    */

    if (
      /(^|\/)(app|server|index|main)\.[jt]sx?$/.test(
        lowerPath
      )
    ) {
      score += 10;
    }

    return {
      ...chunk,
      score,
    };
  });

  scored.sort(
    (a, b) => b.score - a.score
  );

  const relevant = scored.filter(
    (chunk) => chunk.score >= 5
  );

  const selected = [];
  const fileCounts = new Map();

  for (const chunk of relevant) {
    const count =
      fileCounts.get(chunk.filePath) || 0;

    if (count >= 2) {
      continue;
    }

    selected.push(chunk);

    fileCounts.set(
      chunk.filePath,
      count + 1
    );

    if (selected.length >= 6) {
      break;
    }
  }

  console.log(
    '🔎 Top retrieved chunks:',
    selected.map((chunk) => ({
      file: chunk.filePath,
      lines: `${chunk.startLine}-${chunk.endLine}`,
      score: chunk.score,
    }))
  );

  return selected;
};
/*
|--------------------------------------------------------------------------
| Deterministic Grounded Fallback
|--------------------------------------------------------------------------
*/

const buildGroundedFallback = ({
  repo,
  question,
  intent,
  chunks,
}) => {
  if (!chunks.length) {
    return `I couldn't find relevant source-code sections for:

**${question}**

The repository is indexed, but the current indexed files do not contain enough matching information to answer this confidently.`;
  }

  const files = [
    ...new Set(
      chunks.map(
        (chunk) => chunk.filePath
      )
    ),
  ];

  let answer = '';

  if (intent === 'authentication') {
    answer +=
      `### Authentication in ${repo.name}\n\n`;

    answer +=
      `The repository's authentication-related implementation appears in these source files:\n\n`;

    files.forEach((file) => {
      answer += `- **${file}**\n`;
    });

    answer +=
      `\nBased on the indexed code, the most relevant authentication logic is shown below:\n\n`;
  } else if (intent === 'routing') {
    answer +=
      `### Routing\n\n`;

    answer +=
      `The most relevant routing implementation was found in:\n\n`;

    files.forEach((file) => {
      answer += `- **${file}**\n`;
    });

    answer += '\n';
  } else if (intent === 'database') {
    answer +=
      `### Database implementation\n\n`;

    answer +=
      `The most relevant database-related code was found in:\n\n`;

    files.forEach((file) => {
      answer += `- **${file}**\n`;
    });

    answer += '\n';
  } else if (intent === 'error-handling') {
    answer +=
      `### Error handling\n\n`;

    answer +=
      `The most relevant error-handling code was found in:\n\n`;

    files.forEach((file) => {
      answer += `- **${file}**\n`;
    });

    answer += '\n';
  } else {
    answer +=
      `### Repository evidence\n\n`;

    answer +=
      `I found the following relevant source files:\n\n`;

    files.forEach((file) => {
      answer += `- **${file}**\n`;
    });

    answer += '\n';
  }

  chunks
    .slice(0, 4)
    .forEach((chunk, index) => {
      const preview =
        String(chunk.content || '')
          .split('\n')
          .filter(
            (line) => line.trim()
          )
          .slice(0, 12)
          .join('\n');

      answer +=
        `### ${index + 1}. ${chunk.filePath}\n`;

      answer +=
        `Lines ${chunk.startLine}-${chunk.endLine}\n\n`;

      answer +=
        '```text\n';

      answer += preview;

      answer +=
        '\n```\n\n';
    });

  answer +=
    `> Gemini AI explanation is currently unavailable. This answer is generated directly from the repository's indexed source code.`;

  return answer;
};


/*
|--------------------------------------------------------------------------
| Repository Question Detection
|--------------------------------------------------------------------------
*/

const isRepositoryQuestion = (question = '') => {
  const q = String(question)
    .toLowerCase()
    .trim();

  /*
  |--------------------------------------------------------------------------
  | Explicit repository references
  |--------------------------------------------------------------------------
  */

  const explicitRepositoryReference =
    /this (repo|repository|project|codebase)|the (repo|repository|project|codebase)|in this (repo|repository|project|codebase)|in the (repo|repository|project|codebase)|our (repo|repository|project|codebase)|my (repo|repository|project|codebase)/i.test(
      q
    );

  if (explicitRepositoryReference) {
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Repository technical terms
  |--------------------------------------------------------------------------
  */

  const repositoryTechnicalTerm =
    /authentication|auth|jwt|login|logout|register|signup|signin|token|password|protected route|authorization|routing|route|router|endpoint|api|navigation|database|mongodb|mongoose|schema|model|collection|query|backend|server|express|controller|middleware|frontend|react|component|jsx|ui|page|client|dependency|dependencies|package|npm|architecture|readme|source code|codebase|file|function|class|module|import|export|bug|error handling|validation/i.test(
      q
    );

  if (repositoryTechnicalTerm) {
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | File names / code references
  |--------------------------------------------------------------------------
  */

  if (
    /\b[\w.-]+\.(js|jsx|ts|tsx|json|md|mjs|cjs|css|html)\b/i.test(
      q
    ) ||
    /`[^`]+`/.test(q)
  ) {
    return true;
  }

  return false;
};


/*
|--------------------------------------------------------------------------
| Repository Chat
|--------------------------------------------------------------------------
*/

export const answerRepositoryQuestion = async (
  repo,
  question
) => {
  console.log(
    '========================================'
  );

  console.log(
    '💬 Repository Chat'
  );

  console.log(
    'Repository:',
    repo.fullName
  );

  console.log(
    'Question:',
    question
  );

  console.log(
    '========================================'
  );

  const lowerQuestion =
    String(question)
      .toLowerCase()
      .trim();


  /*
  |--------------------------------------------------------------------------
  | Casual conversation — ZERO RAG / ZERO GEMINI
  |--------------------------------------------------------------------------
  */

  const isCasualConversation =
    /^(how are you|how r u|how are u|how r you|what'?s up|whats up|how do you feel|how's it going|hows it going)[!?.\s]*$/i.test(
      lowerQuestion
    );

  if (isCasualConversation) {
    console.log(
      '💬 Casual conversation detected. Skipping RAG and Gemini.'
    );

    return {
      answer:
        "I'm doing well! 👋 I'm ready to help you understand this repository or answer any question.",
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Local greetings — ZERO RAG / ZERO GEMINI
  |--------------------------------------------------------------------------
  */

  const isGreeting =
    /^(hi+|hie+|hello|hey|sup|yo|thanks|thank you|ok|okay|great|cool|nice|test)[!.\s]*$/i.test(
      lowerQuestion
    );

  if (isGreeting) {
    return {
      answer: `👋 Hi! I'm GitInsight AI for **${repo.fullName}**.

I can help you understand this repository's code, structure, dependencies, architecture, authentication, routing, database, and implementation details.

You can also ask me normal general questions.`,
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Local repository metadata — ZERO GEMINI
  |--------------------------------------------------------------------------
  */

  if (
    /^(what('?s| is) )?(the )?(name|project name)( of (my|this) project)?\??$/i.test(
      lowerQuestion
    )
  ) {
    return {
      answer: `The project name is **${repo.name}** (repository: ${repo.fullName}).${
        repo.description
          ? `\n\n${repo.description}`
          : ''
      }`,
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Project purpose
  |--------------------------------------------------------------------------
  */

  if (
    /^(what (does|is) (this|the) project|what does this project do|project purpose)\??$/i.test(
      lowerQuestion
    )
  ) {
    const description =
      repo.description?.trim();

    const readme =
      repo.readme?.content?.trim();

    return {
      answer: description
        ? `**${repo.name}** is described as:\n\n${description}`
        : readme
          ? `Based on the repository README:\n\n${readme.slice(
              0,
              1500
            )}`
          : `I don't have enough stored repository metadata to describe the project's purpose confidently.`,
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Dependencies
  |--------------------------------------------------------------------------
  */

  if (
    /^(what are )?(the )?(core )?(runtime )?dependencies|dependencies( of (this|the) project)?\??$/i.test(
      lowerQuestion
    )
  ) {
    const runtime =
      repo.dependencies?.runtime || [];

    const dev =
      repo.dependencies?.dev || [];

    return {
      answer:
        `### Runtime dependencies\n\n${
          runtime.length
            ? runtime
                .slice(0, 20)
                .map(
                  (d) =>
                    `- **${d.name}** ${
                      d.version || ''
                    }`.trim()
                )
                .join('\n')
            : 'No runtime dependencies were detected.'
        }\n\n` +
        `### Development dependencies\n\n${
          dev.length
            ? dev
                .slice(0, 20)
                .map(
                  (d) =>
                    `- **${d.name}** ${
                      d.version || ''
                    }`.trim()
                )
                .join('\n')
            : 'No development dependencies were detected.'
        }`,
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Languages
  |--------------------------------------------------------------------------
  */

  if (
    /^(what('?s| is) )?(the )?(primary )?language|languages( used)?\??$/i.test(
      lowerQuestion
    )
  ) {
    const languages =
      repo.languages?.length
        ? repo.languages
            .map(
              (l) =>
                `- **${l.name}** — ${l.percentage}%`
            )
            .join('\n')
        : `Primary language: **${
            repo.primaryLanguage ||
            'Unknown'
          }**`;

    return {
      answer: `### Repository languages\n\n${languages}`,
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Determine whether this is repository-related
  |--------------------------------------------------------------------------
  */

  const repositoryQuestion =
    isRepositoryQuestion(question);


  /*
  |--------------------------------------------------------------------------
  | GENERAL QUESTION
  |
  | Anything that is not clearly related to the repository goes directly
  | to Gemini. RAG is completely skipped.
  |--------------------------------------------------------------------------
  */

  if (!repositoryQuestion) {
    console.log(
      '🌐 General question detected. Skipping RAG.'
    );

    const generalResult =
      await generateGeminiText(question);

    /*
    |----------------------------------------------------------------------
    | generateGeminiText() returns a STRING, not an object.
    |---------------------------------------------------------------------- 
    */

    if (
      typeof generalResult === 'string' &&
      generalResult.trim()
    ) {
      return {
        answer: generalResult.trim(),
        sources: [],
      };
    }

    return {
      answer:
        'Gemini is currently unavailable. Please try the general question again later.',
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | REPOSITORY QUESTION
  |
  | Only now do we use RAG.
  |--------------------------------------------------------------------------
  */

  console.log(
    '📚 Repository question detected. Using RAG.'
  );


  /*
  |--------------------------------------------------------------------------
  | Make sure repository is indexed
  |--------------------------------------------------------------------------
  */

  let chunkCount =
    await RepositoryChunk.countDocuments({
      repositoryId: repo._id,
    });

  if (chunkCount === 0) {
    console.log(
      '📚 No chunks found. Indexing repository...'
    );

    await indexRepositoryFiles(repo);

    chunkCount =
      await RepositoryChunk.countDocuments({
        repositoryId: repo._id,
      });

    console.log(
      `📚 Chunks available after indexing: ${chunkCount}`
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Retrieve relevant code
  |--------------------------------------------------------------------------
  */

  const relevantChunks =
    await retrieveChunks(
      repo._id,
      question
    );

  console.log(
    `🔎 Retrieved ${relevantChunks.length} relevant chunks`
  );


  const intent =
    detectQueryIntent(question);


  /*
  |--------------------------------------------------------------------------
  | Sources
  |--------------------------------------------------------------------------
  */

  const sources =
    relevantChunks.map(
      (chunk) => ({
        file: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        snippet:
          chunk.content.slice(0, 200),
      })
    );


  /*
  |--------------------------------------------------------------------------
  | No relevant chunks
  |--------------------------------------------------------------------------
  */

  if (!relevantChunks.length) {
    return {
      answer:
        buildGroundedFallback({
          repo,
          question,
          intent,
          chunks: [],
        }),
      sources: [],
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Prepare context for Gemini
  |--------------------------------------------------------------------------
  */

  const contextText =
    relevantChunks
      .map(
        (chunk) =>
          `--- FILE: ${chunk.filePath} (Lines ${chunk.startLine}-${chunk.endLine}) ---\n${chunk.content}`
      )
      .join('\n\n');

  console.log(
    '🧠 Context prepared for Gemini'
  );

  console.log(
    `Context length: ${contextText.length} characters`
  );


  /*
  |--------------------------------------------------------------------------
  | Gemini Repository Answer
  |--------------------------------------------------------------------------
  */

  const aiResult =
    await generateRepositoryChat(
      repo,
      question,
      contextText
    );


  /*
  |--------------------------------------------------------------------------
  | Gemini succeeded
  |--------------------------------------------------------------------------
  */

  if (
    aiResult?.answer &&
    aiResult.source === 'gemini'
  ) {
    console.log(
      '✅ Gemini successfully generated an answer'
    );

    return {
      answer: cleanEmptyAsterisks(aiResult.answer),
      sources,
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Gemini unavailable
  |--------------------------------------------------------------------------
  */

  console.warn(
    `⚠️ Gemini unavailable: ${
      aiResult?.errorType || 'UNKNOWN'
    }. Using grounded fallback.`
  );

  return {
    answer:
      cleanEmptyAsterisks(
        buildGroundedFallback({
          repo,
          question,
          intent,
          chunks: relevantChunks,
        })
      ),
    sources,
  };
};