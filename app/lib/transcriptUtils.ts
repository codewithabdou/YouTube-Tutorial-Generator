import { getSubtitles } from "youtube-caption-extractor";
import { Innertube } from "youtubei.js";

export interface TranscriptResult {
    text: string;
    source: string;
}

/**
 * Fetches transcript using a multi-strategy approach to handle Vercel/IP blocking.
 * 1. youtubei.js (InnerTube): Emulates a real Android/Web client (most robust).
 * 2. youtube-caption-extractor: Fallback scraping method.
 */
export async function fetchTranscriptWithFallback(
    videoId: string
): Promise<TranscriptResult | null> {
    const errors: string[] = [];

    // Strategy 1: youtubei.js (InnerTube)
    // This library emulates internal YouTube API calls and is more resistant to bot detection
    try {
        console.log(`[Transcript] Strategy 1: Attempting youtubei.js (InnerTube)...`);

        const youtube = await Innertube.create();
        const info = await youtube.getInfo(videoId);
        const transcriptData = await info.getTranscript();

        if (transcriptData && transcriptData.transcript?.content?.body?.initial_segments) {
            const segments = transcriptData.transcript.content.body.initial_segments;

            // Extract text from segments
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const text = segments.map((seg: any) => seg.snippet.text).join(" ");

            if (text.length > 50) {
                console.log(`[Transcript] Success (youtubei.js): ${text.length} chars`);
                return { text, source: 'youtubei.js (InnerTube)' };
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[Transcript] Strategy 1 failed: ${msg}`);
        errors.push(`youtubei.js: ${msg}`);
    }

    // Strategy 2: youtube-caption-extractor (Fallback)
    try {
        console.log(`[Transcript] Strategy 2: Attempting youtube-caption-extractor...`);
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
                // Try next language silently
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[Transcript] Strategy 2 failed: ${msg}`);
        errors.push(`youtube-caption-extractor: ${msg}`);
    }

    console.log(`[Transcript] All strategies failed.`);
    // Turn array of errors into a single string for better debugging upstream
    if (errors.length > 0) {
        console.error(`[Transcript] Failure Details:\n${errors.join('\n')}`);
        throw new Error(`Transcript extraction failed. Details:\n${errors.join('\n')}`);
    }

    return null;
}


