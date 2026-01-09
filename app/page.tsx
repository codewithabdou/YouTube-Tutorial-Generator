"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { extractVideoId } from "@/app/lib/clientUtils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TutorialCard } from "./components/TutorialCard";
import { ProgressBar } from "./components/ProgressBar";
import {
  Youtube,
  Sparkles,
  AlertCircle,
  ArrowRight,
  BookOpen,
  FileText,
  ArrowLeft,
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface ProgressState {
  value: number;
  message: string;
}

interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration: number;
  videoId: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [tutorial, setTutorial] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ProgressState>({ value: 0, message: "" });
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);

  const generateTutorial = useCallback(async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    setStatus("loading");
    setError("");
    setVideoMetadata(null);
    setProgress({ value: 10, message: "Extracting video ID..." });

    // Progress stages for transcript-only processing
    const progressStages = [
      { value: 15, message: "Fetching video info...", delay: 1000 },
      { value: 35, message: "Extracting transcript...", delay: 3000 },
      { value: 60, message: "Analyzing content with AI...", delay: 4000 },
      { value: 85, message: "Generating documentation...", delay: 3000 },
    ];

    // Start progress animation
    let stageIndex = 0;
    const progressInterval = setInterval(() => {
      if (stageIndex < progressStages.length) {
        const stage = progressStages[stageIndex];
        setProgress({ value: stage.value, message: stage.message });
        stageIndex++;
      }
    }, 1500);

    // Extract ID immediately for instant thumbnail
    const videoId = extractVideoId(url);
    if (videoId) {
      setVideoMetadata({
        title: "Loading video details...",
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        videoId: videoId
      });
    }

    try {
      // Step 1: Fetch full video metadata (this runs in background while showing instant thumbnail)
      fetch("/api/video-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }).then(async (res) => {
        if (res.ok) {
          const infoData = await res.json();
          setVideoMetadata(prev => ({
            ...infoData,
            thumbnail: infoData.thumbnail || prev?.thumbnail || ""
          }));
        }
      });

      // Generate tutorial
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate tutorial");
      }

      setProgress({ value: 100, message: "Complete!" });

      // Small delay to show 100%
      await new Promise((resolve) => setTimeout(resolve, 500));

      setTutorial(data.tutorial);
      setStatus("success");
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }, [url]);

  const handleReset = () => {
    setStatus("idle");
    setTutorial("");
    setError("");
    setUrl("");
    setProgress({ value: 0, message: "" });
  };

  return (
    <main className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          {/* Logo */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff0000]">
              <Youtube className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white md:text-5xl">
              TubeTutor
            </h1>
          </div>

          <p className="mx-auto max-w-xl text-lg text-[#aaaaaa]">
            Transform any YouTube coding tutorial into{" "}
            <span className="text-white">beautiful documentation</span>
          </p>
        </motion.header>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {status === "idle" || status === "error" ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-2xl"
            >
              {/* Input Section */}
              <div className="rounded-xl bg-[#212121] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Youtube className="h-5 w-5 text-[#ff0000]" />
                  <span className="font-medium text-white">Paste YouTube URL</span>
                </div>

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (error) setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && generateTutorial()}
                      className="h-12 rounded-full border-[#303030] bg-[#121212] text-white placeholder:text-[#717171] focus-visible:ring-[#3ea6ff]"
                    />
                  </div>
                  <Button
                    onClick={generateTutorial}
                    className="h-12 gap-2 rounded-full bg-[#ff0000] px-6 text-white transition-opacity hover:bg-[#ff0000] hover:opacity-90"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate
                  </Button>
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 flex items-center gap-2 rounded-lg bg-[#331111] px-4 py-3 text-sm text-[#ff6b6b]"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : status === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="mb-8 flex flex-col items-center">
                {videoMetadata ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative mb-8 overflow-hidden rounded-xl"
                  >
                    <div className="relative h-48 w-80 sm:h-56 sm:w-96">
                      <img
                        src={videoMetadata.thumbnail}
                        alt="Video Thumbnail"
                        className="h-full w-full object-cover"
                      />
                      {/* Overlay Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-transparent" />

                      {/* Title Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="line-clamp-2 text-center text-lg font-semibold leading-tight text-white">
                          {videoMetadata.title}
                        </h3>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#212121]">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Youtube className="h-10 w-10 text-[#ff0000]" />
                    </motion.div>
                  </div>
                )}

                <h2 className="mb-2 text-xl font-semibold text-white">
                  Creating Your Tutorial
                </h2>
                <div className="flex items-center gap-2 text-sm text-[#aaaaaa]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff0000] opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff0000]"></span>
                  </span>
                  Processing video content...
                </div>
              </div>

              <div className="w-full max-w-md">
                <ProgressBar progress={progress.value} status={progress.message} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Back button */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
              >
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2 rounded-full border-[#303030] bg-[#212121] text-[#aaaaaa] hover:bg-[#272727] hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Generate Another
                </Button>
              </motion.div>

              <TutorialCard content={tutorial} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
