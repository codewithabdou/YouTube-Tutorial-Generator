import { getSubtitles } from "youtube-caption-extractor";

export interface TranscriptResult {
    text: string;
    source: string;
}

/**
 * Fetches transcript using youtube-caption-extractor
 * Previous strategies using youtube-transcript and ytdl-core were removed due to reliability issues.
 */
export async function fetchTranscriptWithFallback(
    videoId: string
): Promise<TranscriptResult | null> {
    console.log(`[Transcript] Fetching transcript for ${videoId}...`);

    // Strategy: youtube-caption-extractor
    try {
        console.log(`[Transcript] Attempting strategy: youtube-caption-extractor`);
        // Try English first, then auto-generated
        const langs = ["en", "en-US", "en-GB", "auto"];

        for (const lang of langs) {
            try {
                const subtitles = await getSubtitles({ videoID: videoId, lang });

                if (subtitles && subtitles.length > 0) {
                    const text = subtitles.map((s: { text: string }) => s.text).join(" ");

                    if (text.trim().length >= 50) {
                        console.log(`[Transcript] Success (youtube-caption-extractor/${lang}): ${text.length} chars`);
                        return { text, source: `youtube-caption-extractor (${lang})` };
                    }
                }
            } catch {
                // Try next language
            }
        }
    } catch (err) {
        console.log(`[Transcript] Strategy failed: ${(err as Error).message}`);
    }

    console.log(`[Transcript] All strategies failed. No captions found.`);
    return null;
}

