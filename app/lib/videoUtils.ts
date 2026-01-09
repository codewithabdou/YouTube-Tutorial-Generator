import ytdl from "@distube/ytdl-core";

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export interface VideoInfo {
    title: string;
    duration: number;
    thumbnails: string[];
    storyboardUrl: string | null;
}

/**
 * Get video information including thumbnails at various points
 * YouTube provides thumbnails at specific positions which we can use for visual code extraction
 */
export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(url);

        const videoDetails = info.videoDetails;
        const duration = parseInt(videoDetails.lengthSeconds) || 0;

        // Get standard thumbnails
        const thumbnails = videoDetails.thumbnails
            .sort((a, b) => (b.width || 0) - (a.width || 0))
            .map(t => t.url);

        // Try to find storyboard/sprite URL from player response
        let storyboardUrl: string | null = null;

        // Get storyboard info if available (undocumented but still works for many videos)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storyboardData = (info as any).player_response?.storyboards?.playerStoryboardSpecRenderer?.spec;
        if (storyboardData) {
            // Storyboard spec format: baseUrl|other|params
            const parts = storyboardData.split('|');
            if (parts[0]) {
                storyboardUrl = parts[0];
            }
        }

        return {
            title: videoDetails.title,
            duration,
            thumbnails,
            storyboardUrl,
        };
    } catch (error) {
        console.error("Error getting video info:", error);
        throw new Error("Could not fetch video information. The video may be private or restricted.");
    }
}

/**
 * Generate thumbnail URLs at specific timestamps for a YouTube video
 * These are official YouTube thumbnails that don't require downloading the video
 */
export function generateThumbnailUrls(videoId: string, duration: number, count: number = 8): string[] {
    const urls: string[] = [];

    // Always include the main thumbnails (high quality)
    urls.push(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    urls.push(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);

    // YouTube auto-generates 3 thumbnails at 25%, 50%, 75% of video
    // These are accessible via specific URLs
    for (let i = 1; i <= 3; i++) {
        urls.push(`https://img.youtube.com/vi/${videoId}/${i}.jpg`);
    }

    // If storyboard available, we'd add those frames here
    // For now, we rely on the standard thumbnails and AI to extract code

    return urls;
}

/**
 * Fetch image as base64 for sending to Gemini Vision API
 */
export async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Determine MIME type from URL
        const mimeType = url.includes(".png") ? "image/png" : "image/jpeg";

        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error("Error fetching image:", error);
        return null;
    }
}

/**
 * Fetch multiple thumbnails and return as base64 array
 * Filters out any that fail to load
 */
export async function fetchThumbnailsAsBase64(videoId: string): Promise<{ url: string; base64: string }[]> {
    const thumbnailUrls = generateThumbnailUrls(videoId, 0, 5);

    const results = await Promise.all(
        thumbnailUrls.map(async (url) => {
            const base64 = await fetchImageAsBase64(url);
            return base64 ? { url, base64 } : null;
        })
    );

    // Filter out nulls and duplicates (sometimes thumbnails are identical)
    const uniqueResults: { url: string; base64: string }[] = [];
    const seen = new Set<string>();

    for (const result of results) {
        if (result && !seen.has(result.base64.slice(0, 100))) {
            seen.add(result.base64.slice(0, 100));
            uniqueResults.push(result);
        }
    }

    return uniqueResults;
}
