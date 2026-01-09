import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getVideoInfo } from "@/app/lib/videoUtils";

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json(
                { error: "YouTube URL is required" },
                { status: 400 }
            );
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            return NextResponse.json(
                { error: "Invalid YouTube URL" },
                { status: 400 }
            );
        }

        const info = await getVideoInfo(videoId);

        // Get the highest resolution thumbnail commonly available
        const thumbnail =
            info.thumbnails.find(t => t.includes("maxresdefault")) ||
            info.thumbnails[0] ||
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        return NextResponse.json({
            title: info.title,
            thumbnail,
            videoId,
            duration: info.duration
        });

    } catch (error) {
        console.error("Error fetching video info:", error);
        return NextResponse.json(
            { error: "Failed to fetch video information" },
            { status: 500 }
        );
    }
}
