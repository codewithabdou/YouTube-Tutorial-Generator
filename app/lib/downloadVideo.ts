export interface VideoResult {
    buffer?: Buffer;
    mimeType?: string;
    useDirectUrl?: boolean;
}

/**
 * Download YouTube video using the Cobalt API.
 * Cobalt is a free, open-source API that handles YouTube downloads reliably.
 * 
 * Falls back to returning null if download fails (tutorial will use transcript only).
 */
export async function downloadVideoAsBuffer(videoId: string): Promise<VideoResult | null> {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`[Video] Downloading video via Cobalt API: ${videoId}`);

    try {
        // Step 1: Request download URL from Cobalt API
        const cobaltResponse = await fetch("https://api.cobalt.tools/", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url: youtubeUrl,
                videoQuality: "480",  // Lower quality for faster download and smaller file
                filenameStyle: "basic",
                downloadMode: "auto",
            }),
        });

        if (!cobaltResponse.ok) {
            const errorText = await cobaltResponse.text();
            console.error(`[Video] Cobalt API error: ${cobaltResponse.status} - ${errorText}`);
            return null;
        }

        const cobaltData = await cobaltResponse.json();
        console.log(`[Video] Cobalt response status: ${cobaltData.status}`);

        // Cobalt returns a download URL
        let downloadUrl: string | null = null;

        if (cobaltData.status === "tunnel" || cobaltData.status === "redirect") {
            downloadUrl = cobaltData.url;
        } else if (cobaltData.status === "picker" && cobaltData.picker?.length > 0) {
            // For videos with multiple formats, pick the first video option
            const videoOption = cobaltData.picker.find((p: { type: string }) => p.type === "video");
            downloadUrl = videoOption?.url || cobaltData.picker[0]?.url;
        } else if (cobaltData.status === "error") {
            console.error(`[Video] Cobalt error: ${cobaltData.error?.code}`);
            return null;
        }

        if (!downloadUrl) {
            console.error(`[Video] No download URL from Cobalt`);
            return null;
        }

        console.log(`[Video] Got download URL, fetching video...`);

        // Step 2: Download the actual video file
        const videoResponse = await fetch(downloadUrl);

        if (!videoResponse.ok) {
            console.error(`[Video] Failed to download video: ${videoResponse.status}`);
            return null;
        }

        const arrayBuffer = await videoResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`[Video] Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

        // Check file size - Gemini has limits
        if (buffer.length > 20 * 1024 * 1024) {
            console.warn(`[Video] Video too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB), Gemini may reject it`);
        }

        return {
            buffer,
            mimeType: "video/mp4",
            useDirectUrl: false
        };

    } catch (error) {
        console.error(`[Video] Download failed:`, error);
        return null;
    }
}
