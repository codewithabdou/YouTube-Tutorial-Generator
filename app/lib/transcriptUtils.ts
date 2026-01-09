import { getSubtitles } from "youtube-caption-extractor";

export interface TranscriptResult {
    text: string;
    source: string;
}

/**
 * Fetches transcript using youtube-caption-extractor
 */
export async function fetchTranscriptWithFallback(
    videoId: string
): Promise<TranscriptResult | null> {
    console.log(`[Transcript] Fetching transcript for ${videoId}...`);

    try {
        // Try English first, then auto-generated
        const langs = ["en", "en-US", "en-GB"];

        for (const lang of langs) {
            try {
                const subtitles = await getSubtitles({ videoID: videoId, lang });

                if (subtitles && subtitles.length > 0) {
                    const text = subtitles.map((s: { text: string }) => s.text).join(" ");

                    if (text.trim().length >= 50) {
                        console.log(`[Transcript] Success (${lang}): ${text.length} chars`);
                        return { text, source: `youtube-caption-extractor (${lang})` };
                    }
                }
            } catch {
                // Try next language
            }
        }

        console.log(`[Transcript] No captions found for any language`);
        return null;

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Transcript] Failed: ${msg}`);
        return null;
    }
}
