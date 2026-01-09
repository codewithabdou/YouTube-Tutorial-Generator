"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
    progress: number;
    status: string;
}

export function ProgressBar({ progress, status }: ProgressBarProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-[#aaaaaa]">{status}</span>
                <span className="font-mono text-white">{Math.round(progress)}%</span>
            </div>

            <div className="relative h-1 overflow-hidden rounded-full bg-[#303030]">
                {/* Progress fill - YouTube red */}
                <motion.div
                    className="h-full rounded-full bg-[#ff0000]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>

            {/* Subtle loading indicator */}
            <div className="mt-4 flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-[#717171]"
                        animate={{
                            opacity: [0.3, 1, 0.3],
                        }}
                        transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                        }}
                    />
                ))}
            </div>
        </motion.div>
    );
}
