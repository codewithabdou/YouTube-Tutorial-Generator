import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchTranscriptWithFallback } from "@/app/lib/transcriptUtils";
import { extractVideoId } from "@/app/lib/videoUtils";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Model fallback configuration - ordered by priority
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

// Track which models have hit quota (resets on server restart)
const modelQuotaExhausted: Set<string> = new Set();

/**
 * Get a working model, falling back through the list if quota is exhausted
 */
function getAvailableModel(): GenerativeModel {
  for (const modelName of FALLBACK_MODELS) {
    if (!modelQuotaExhausted.has(modelName)) {
      console.log(`[API] Using model: ${modelName}`);
      return genAI.getGenerativeModel({ model: modelName });
    }
  }
  // All models exhausted, try the first one anyway (quota might have reset)
  console.log(`[API] All models quota exhausted, retrying: ${FALLBACK_MODELS[0]}`);
  modelQuotaExhausted.clear();
  return genAI.getGenerativeModel({ model: FALLBACK_MODELS[0] });
}

/**
 * Generate content with automatic model fallback on quota errors
 */
async function generateWithFallback(prompt: string, retryCount = 0): Promise<{ text: string; model: string }> {
  const maxRetries = FALLBACK_MODELS.length;

  if (retryCount >= maxRetries) {
    throw new Error("All models have hit quota limits. Please try again later.");
  }

  const model = getAvailableModel();
  const modelName = FALLBACK_MODELS.find(m => !modelQuotaExhausted.has(m)) || FALLBACK_MODELS[0];

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { text: response.text(), model: modelName };
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };

    // Check if it's a quota error (429 or 503)
    if (err.status === 429 || err.status === 503 ||
      (err.message && (err.message.includes('quota') || err.message.includes('Resource exhausted')))) {
      console.log(`[API] Model ${modelName} hit quota limit, switching to next model...`);
      modelQuotaExhausted.add(modelName);
      return generateWithFallback(prompt, retryCount + 1);
    }

    throw error;
  }
}

// Constants for chunking
const CHUNK_SIZE = 20000; // 20k chars per chunk
const OVERLAP_SIZE = 500; // 500 chars overlap between chunks

// THE ULTIMATE TRANSCRIPT-TO-TUTORIAL PROMPT (for first chunk)
const TUTORIAL_PROMPT = `You are an elite technical documentation writer. Your mission is to transform a raw YouTube tutorial transcript into world-class, production-ready documentation that rivals official framework docs.

## YOUR EXPERTISE
You write documentation like the best in the industry: React docs, Stripe docs, Vercel docs. Clean, scannable, actionable.

## CRITICAL RULES

### 1. CODE RECONSTRUCTION (HIGHEST PRIORITY)
The transcript is spoken word - the instructor dictates code out loud. You MUST:
- **Reconstruct complete, working code** from verbal descriptions
- When they say "create a function called X that takes Y and returns Z" → write the actual function
- When they say "import React from react" → write \`import React from 'react'\`
- When they mention file names → use them as section headers
- When they describe terminal commands → format as bash code blocks
- Fill in obvious gaps (imports, exports, boilerplate) that speakers skip
- Use modern syntax and best practices for the language mentioned

### 2. STRUCTURE
Use this exact structure:

# [Tutorial Title - infer from content]

## Overview
[2-3 sentences: what we're building and why it matters]

## Prerequisites  
[Bullet list: required knowledge, tools, versions]

## Table of Contents
[Link to each major section]

## 1. [First Major Section]
### Step 1.1: [Specific action]
[Brief explanation]
\`\`\`language
[Complete, working code]
\`\`\`

### Step 1.2: [Next action]
...

## 2. [Second Major Section]
...

## Summary
[Key takeaways]

## Next Steps
[Where to go from here]

### 3. FORMATTING STANDARDS
- Use \`\`\`typescript, \`\`\`javascript, \`\`\`python, \`\`\`bash, \`\`\`css, etc.
- Use \`inline code\` for: file names, function names, variable names, package names, commands
- Use **bold** for emphasis on key concepts
- Use > blockquotes for important tips or warnings
- Keep paragraphs short (2-3 sentences max)
- Use bullet points for lists of items

### 4. WHAT TO REMOVE
- ALL filler words: "um", "uh", "like", "you know", "so", "basically", "actually", "right", "okay"
- References to video: "as you can see", "if you look here", "in this video", "let me show you"
- Timestamps or time references
- Tangents and off-topic commentary
- Repetition and restarts

### 5. WHAT TO ADD
- Missing imports that are clearly needed
- Type annotations if using TypeScript
- Brief explanations of WHY, not just WHAT
- Error handling if the context suggests it
- Comments in code for complex logic

### 6. QUALITY CHECKS
Before finishing, verify:
- [ ] Every code block is complete and runnable
- [ ] Imports match what's used in the code
- [ ] File names are clearly indicated
- [ ] Steps are in logical order
- [ ] No filler words remain
- [ ] Professional tone throughout

## OUTPUT REQUIREMENTS
Generate documentation so good that:
1. A developer could follow it without watching the video
2. It could be published on an official docs site
3. Every code block works when copy-pasted
4. The structure is instantly scannable`;

// CONTINUATION PROMPT (for subsequent chunks)
const CONTINUATION_PROMPT = `You are continuing to write a technical tutorial documentation. You have already written the beginning of the tutorial based on the first part of the transcript.

## CONTEXT FROM PREVIOUS SECTION
Here is a summary of what has been covered so far:
{PREVIOUS_SUMMARY}

The last section you wrote ended with:
{LAST_SECTION_PREVIEW}

## YOUR TASK
Continue writing the tutorial from where you left off. The transcript below picks up from where the previous section ended.

## CRITICAL RULES
1. **DO NOT** repeat the Overview, Prerequisites, or Table of Contents - those are already written
2. **DO NOT** restart section numbering - continue from where you left off
3. **MAINTAIN** the same formatting style and structure
4. **CONTINUE** the step-by-step flow naturally
5. If this is the FINAL chunk, include the Summary and Next Steps sections

## FORMATTING REMINDERS
- Use \`\`\`language for code blocks
- Use \`inline code\` for file names, function names, variables
- Keep the same professional tone

Continue the tutorial now:`;

// FINAL CHUNK INDICATOR
const FINAL_CHUNK_SUFFIX = `

**IMPORTANT**: This is the FINAL section of the transcript. Make sure to:
1. Complete any remaining steps
2. Add a "## Summary" section with key takeaways
3. Add a "## Next Steps" section with suggestions for further learning`;

/**
 * Split transcript into overlapping chunks
 */
function chunkTranscript(transcript: string): string[] {
  if (transcript.length <= CHUNK_SIZE) {
    return [transcript];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < transcript.length) {
    let endIndex = startIndex + CHUNK_SIZE;

    // If not the last chunk, try to find a good break point (end of sentence)
    if (endIndex < transcript.length) {
      // Look for sentence endings near the chunk boundary
      const searchStart = endIndex - 200;
      const searchEnd = endIndex + 200;
      const searchRegion = transcript.substring(searchStart, Math.min(searchEnd, transcript.length));

      // Find the last sentence ending (. ! ?) in the search region
      const sentenceEndMatch = searchRegion.match(/[.!?]\s+(?=[A-Z])/g);
      if (sentenceEndMatch) {
        const lastMatch = searchRegion.lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
        if (lastMatch !== -1) {
          endIndex = searchStart + lastMatch + sentenceEndMatch[sentenceEndMatch.length - 1].length;
        }
      }
    }

    chunks.push(transcript.substring(startIndex, endIndex));

    // Next chunk starts with overlap
    startIndex = endIndex - OVERLAP_SIZE;

    // Prevent infinite loop
    if (startIndex >= transcript.length - OVERLAP_SIZE) {
      break;
    }
  }

  return chunks;
}

/**
 * Extract a summary from the generated content for context passing
 */
function extractSummary(content: string): string {
  // Extract headings to understand what was covered
  const headings = content.match(/^##?\s+.+$/gm) || [];
  const summaryParts: string[] = [];

  // Get section titles
  headings.slice(0, 10).forEach(h => {
    summaryParts.push(h.replace(/^#+\s+/, ''));
  });

  if (summaryParts.length === 0) {
    // Fallback: just use the last 500 chars
    return content.slice(-500);
  }

  return `Sections covered: ${summaryParts.join(', ')}`;
}

/**
 * Get the last section preview for context
 */
function getLastSectionPreview(content: string): string {
  // Get last 500 chars, but try to start at a section boundary
  const last1000 = content.slice(-1000);
  const lastHeadingMatch = last1000.match(/##\s+[^\n]+/g);

  if (lastHeadingMatch) {
    const lastHeadingIndex = last1000.lastIndexOf(lastHeadingMatch[lastHeadingMatch.length - 1]);
    return last1000.substring(lastHeadingIndex);
  }

  return content.slice(-500);
}

/**
 * Merge multiple tutorial responses, removing duplicate content
 */
function mergeResponses(responses: string[]): string {
  if (responses.length === 1) {
    return responses[0];
  }

  let merged = responses[0];

  for (let i = 1; i < responses.length; i++) {
    const current = responses[i];

    // Try to find overlap and remove it
    // Look for repeated section headings
    const firstHeadingMatch = current.match(/^##\s+.+$/m);
    if (firstHeadingMatch) {
      const firstHeading = firstHeadingMatch[0];
      const headingInPrevious = merged.lastIndexOf(firstHeading);

      if (headingInPrevious !== -1) {
        // Remove everything after this heading in the previous content
        merged = merged.substring(0, headingInPrevious);
      }
    }

    // Remove any duplicate "# Title" if present (shouldn't happen with continuations)
    const cleanedCurrent = current.replace(/^#\s+[^\n]+\n+##\s+Overview[\s\S]*?(?=##\s+\d)/m, '');

    merged += '\n\n' + cleanedCurrent;
  }

  // Clean up excessive newlines
  merged = merged.replace(/\n{4,}/g, '\n\n\n');

  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL. Please provide a valid YouTube video link." },
        { status: 400 }
      );
    }

    console.log(`[API] Processing video: ${videoId}`);

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured. Please add GEMINI_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    // Fetch transcript
    let transcript: string | null = null;
    let transcriptSource: string | null = null;

    try {
      console.log(`[API] Fetching transcript...`);
      const result = await fetchTranscriptWithFallback(videoId);

      if (result) {
        transcript = result.text;
        transcriptSource = result.source;
        console.log(`[API] Transcript success via ${result.source}: ${result.text.length} chars`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[API] Transcript error: ${errorMessage}`);
    }

    // Must have transcript
    if (!transcript) {
      return NextResponse.json(
        {
          error: "Could not extract transcript from this video.\n\nTips:\n• Make sure the video has captions/subtitles enabled\n• Auto-generated captions work too\n• Some videos have region-restricted captions"
        },
        { status: 400 }
      );
    }

    // --- DEBUG LOGGING ---
    // Debug logging removed as requested

    // Chunk the transcript
    const chunks = chunkTranscript(transcript);
    console.log(`[API] Transcript chunked into ${chunks.length} parts (${transcript.length} total chars)`);

    // Process each chunk
    const responses: string[] = [];
    let previousSummary = "";
    let lastSectionPreview = "";

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;
      const isLastChunk = i === chunks.length - 1;

      console.log(`[API] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);

      let prompt: string;

      if (isFirstChunk) {
        // First chunk: use full tutorial prompt
        prompt = `${TUTORIAL_PROMPT}

---
## TRANSCRIPT TO CONVERT (Part 1 of ${chunks.length})
---

${chunk}

---
END OF TRANSCRIPT SECTION
---

${chunks.length > 1 ? 'Note: This is part 1 of a multi-part transcript. Focus on the beginning sections (Overview, Prerequisites, Table of Contents, and start the main content). Do NOT include Summary/Next Steps yet.' : 'Generate the complete tutorial now.'}`;
      } else {
        // Continuation chunks: use continuation prompt with context
        prompt = CONTINUATION_PROMPT
          .replace('{PREVIOUS_SUMMARY}', previousSummary)
          .replace('{LAST_SECTION_PREVIEW}', lastSectionPreview);

        prompt += `

---
## TRANSCRIPT CONTINUATION (Part ${i + 1} of ${chunks.length})
---

${chunk}

---
END OF TRANSCRIPT SECTION
---`;

        if (isLastChunk) {
          prompt += FINAL_CHUNK_SUFFIX;
        }
      }

      // Debug prompt save removed

      // Generate response for this chunk with model fallback
      const { text: chunkResponse, model: usedModel } = await generateWithFallback(prompt);

      console.log(`[API] Chunk ${i + 1} response: ${chunkResponse.length} chars (model: ${usedModel})`);

      responses.push(chunkResponse);

      // Extract context for next chunk
      if (!isLastChunk) {
        previousSummary = extractSummary(responses.join('\n\n'));
        lastSectionPreview = getLastSectionPreview(chunkResponse);
      }

      // Debug response save removed
    }

    // Merge all responses
    console.log(`[API] Merging ${responses.length} responses...`);
    const tutorial = mergeResponses(responses);

    console.log(`[API] Final tutorial: ${tutorial.length} chars`);

    // Debug final response save removed

    return NextResponse.json({
      success: true,
      tutorial,
      videoId,
      hasTranscript: true,
      transcriptSource,
      chunksProcessed: chunks.length,
    });

  } catch (error) {
    console.error("[API] Fatal error:", error);
    return NextResponse.json(
      { error: "Failed to generate tutorial. Please try again later." },
      { status: 500 }
    );
  }
}
