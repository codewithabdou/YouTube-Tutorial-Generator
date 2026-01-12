import sharp from "sharp";

interface StoryboardInfo {
    baseUrl: string;
    cols: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    totalSheets: number;
}

/**
 * Extract storyboard information from YouTube video
 * Storyboards are sprite sheets containing multiple frames used for video preview
 */
export async function getStoryboardInfo(videoId: string): Promise<StoryboardInfo | null> {
    // Storyboard extraction relied on @distube/ytdl-core which has been removed.
    // Returning null will trigger the fallback to standard thumbnails.
    console.log("[Storyboard] Storyboard extraction disabled (ytdl-core removed). Using fallback.");
    return null;
}


/**
 * Generate storyboard sheet URLs for a video
 */
export function getStoryboardSheetUrls(baseUrl: string, sheetCount: number): string[] {
    const urls: string[] = [];

    for (let i = 0; i < sheetCount; i++) {
        // Replace placeholders in the URL
        // $L = level (quality), $N = sheet number, M$M = sheet number with M prefix
        let sheetUrl = baseUrl
            .replace("$L", "2") // Use quality level 2 (higher res)
            .replace("$N", i.toString())
            .replace(/M\$M/g, `M${i}`);

        urls.push(sheetUrl);
    }

    return urls;
}

/**
 * Download a storyboard sheet and extract individual frames
 */
export async function extractFramesFromSheet(
    sheetUrl: string,
    cols: number,
    rows: number,
    frameWidth: number,
    frameHeight: number,
    maxFrames: number = 25
): Promise<Buffer[]> {
    try {
        // Fetch the sprite sheet
        const response = await fetch(sheetUrl);
        if (!response.ok) {
            console.log(`[Storyboard] Failed to fetch sheet: ${response.status}`);
            return [];
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const frames: Buffer[] = [];

        // Use sharp to extract individual frames from the sprite sheet
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            console.log("[Storyboard] Could not get image metadata");
            return [];
        }

        // Calculate actual frame dimensions from the image
        const actualFrameWidth = Math.floor(metadata.width / cols);
        const actualFrameHeight = Math.floor(metadata.height / rows);

        // Extract frames from the grid
        let extracted = 0;
        for (let row = 0; row < rows && extracted < maxFrames; row++) {
            for (let col = 0; col < cols && extracted < maxFrames; col++) {
                const left = col * actualFrameWidth;
                const top = row * actualFrameHeight;

                try {
                    const frameBuffer = await sharp(imageBuffer)
                        .extract({
                            left,
                            top,
                            width: actualFrameWidth,
                            height: actualFrameHeight,
                        })
                        .jpeg({ quality: 80 })
                        .toBuffer();

                    frames.push(frameBuffer);
                    extracted++;
                } catch {
                    // Skip frames that fail to extract
                }
            }
        }

        console.log(`[Storyboard] Extracted ${frames.length} frames from sheet`);
        return frames;
    } catch (error) {
        console.error("[Storyboard] Error extracting frames:", error);
        return [];
    }
}

/**
 * Get sampled frames from a video at regular intervals
 * Returns base64-encoded JPEG images
 */
export async function getSampledVideoFrames(
    videoId: string,
    targetFrameCount: number = 10
): Promise<string[]> {
    try {
        // Get storyboard info
        const storyboardInfo = await getStoryboardInfo(videoId);

        if (!storyboardInfo) {
            console.log("[Storyboard] No storyboard available, falling back to thumbnails");
            return await getFallbackThumbnails(videoId);
        }

        const { baseUrl, cols, rows, frameWidth, frameHeight, frameCount, totalSheets } = storyboardInfo;

        // Calculate which sheets to download to get evenly spaced frames
        const framesPerSheet = cols * rows;
        const frameInterval = Math.max(1, Math.floor(frameCount / targetFrameCount));

        // Determine which sheets we need
        const sheetsToFetch = new Set<number>();
        const targetFrameIndices: number[] = [];

        for (let i = 0; i < targetFrameCount; i++) {
            const frameIndex = Math.min(i * frameInterval, frameCount - 1);
            const sheetIndex = Math.floor(frameIndex / framesPerSheet);
            sheetsToFetch.add(sheetIndex);
            targetFrameIndices.push(frameIndex);
        }

        // Get sheet URLs
        const allSheetUrls = getStoryboardSheetUrls(baseUrl, totalSheets);

        // Download and extract frames from needed sheets
        const allFrames: { index: number; buffer: Buffer }[] = [];

        for (const sheetIndex of sheetsToFetch) {
            if (sheetIndex >= allSheetUrls.length) continue;

            const sheetUrl = allSheetUrls[sheetIndex];
            const frames = await extractFramesFromSheet(
                sheetUrl,
                cols,
                rows,
                frameWidth,
                frameHeight
            );

            // Map frames to their global indices
            frames.forEach((buffer, localIndex) => {
                const globalIndex = sheetIndex * framesPerSheet + localIndex;
                allFrames.push({ index: globalIndex, buffer });
            });
        }

        // Select the frames closest to our target indices
        const selectedFrames: string[] = [];

        for (const targetIndex of targetFrameIndices) {
            // Find the closest frame we have
            let closest = allFrames[0];
            let minDiff = Math.abs(allFrames[0]?.index - targetIndex) ?? Infinity;

            for (const frame of allFrames) {
                const diff = Math.abs(frame.index - targetIndex);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = frame;
                }
            }

            if (closest && !selectedFrames.includes(closest.buffer.toString("base64"))) {
                selectedFrames.push(closest.buffer.toString("base64"));
            }
        }

        console.log(`[Storyboard] Selected ${selectedFrames.length} sampled frames`);
        return selectedFrames;
    } catch (error) {
        console.error("[Storyboard] Error getting sampled frames:", error);
        return await getFallbackThumbnails(videoId);
    }
}

/**
 * Fallback to YouTube thumbnails if storyboard extraction fails
 */
async function getFallbackThumbnails(videoId: string): Promise<string[]> {
    const thumbnailUrls = [
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/1.jpg`,
        `https://img.youtube.com/vi/${videoId}/2.jpg`,
        `https://img.youtube.com/vi/${videoId}/3.jpg`,
    ];

    const frames: string[] = [];

    for (const url of thumbnailUrls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                frames.push(buffer.toString("base64"));
            }
        } catch {
            // Skip failed thumbnails
        }
    }

    console.log(`[Storyboard] Fallback: got ${frames.length} thumbnails`);
    return frames;
}
