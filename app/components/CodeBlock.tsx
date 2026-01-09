"use client";

import { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";
import { motion } from "framer-motion";
import { Highlight, themes } from "prism-react-renderer";

interface CodeBlockProps {
    code: string;
    language?: string;
}

export function CodeBlock({ code, language = "plaintext" }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    // Map common language identifiers
    const getLanguageLabel = (lang: string) => {
        const langMap: Record<string, string> = {
            js: "JavaScript",
            ts: "TypeScript",
            jsx: "JSX",
            tsx: "TSX",
            py: "Python",
            python: "Python",
            java: "Java",
            cpp: "C++",
            c: "C",
            cs: "C#",
            go: "Go",
            rust: "Rust",
            rb: "Ruby",
            ruby: "Ruby",
            php: "PHP",
            swift: "Swift",
            kotlin: "Kotlin",
            bash: "Bash",
            sh: "Shell",
            shell: "Shell",
            zsh: "Zsh",
            powershell: "PowerShell",
            sql: "SQL",
            html: "HTML",
            css: "CSS",
            scss: "SCSS",
            sass: "Sass",
            less: "Less",
            json: "JSON",
            yaml: "YAML",
            yml: "YAML",
            xml: "XML",
            md: "Markdown",
            markdown: "Markdown",
            dockerfile: "Dockerfile",
            docker: "Docker",
            plaintext: "Code",
        };
        return langMap[lang.toLowerCase()] || lang.toUpperCase();
    };

    // Map to prism language names
    const getPrismLanguage = (lang: string): string => {
        const prismMap: Record<string, string> = {
            js: "javascript",
            ts: "typescript",
            py: "python",
            rb: "ruby",
            sh: "bash",
            shell: "bash",
            zsh: "bash",
            yml: "yaml",
            md: "markdown",
            dockerfile: "docker",
        };
        return prismMap[lang.toLowerCase()] || lang.toLowerCase();
    };

    const lines = code.split("\n");
    const lineNumberWidth = String(lines.length).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="group relative my-6 overflow-hidden rounded-xl bg-[#181818] border border-[#303030]"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#303030] bg-[#0f0f0f] px-4 py-3">
                <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-[#717171]" />
                    <span className="text-xs font-medium text-[#aaaaaa]">
                        {getLanguageLabel(language)}
                    </span>
                </div>

                {/* Copy button */}
                <motion.button
                    onClick={copyToClipboard}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${copied
                            ? "bg-[#1a3d1a] text-[#4ade80]"
                            : "bg-[#272727] text-[#aaaaaa] hover:bg-[#3f3f3f] hover:text-white"
                        }`}
                    aria-label="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                        </>
                    )}
                </motion.button>
            </div>

            {/* Code content with syntax highlighting */}
            <div className="overflow-x-auto">
                <Highlight
                    theme={themes.nightOwl}
                    code={code}
                    language={getPrismLanguage(language)}
                >
                    {({ style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            className="p-4 text-sm leading-relaxed font-mono"
                            style={{ ...style, background: 'transparent', margin: 0 }}
                        >
                            {tokens.map((line, lineIndex) => {
                                const lineProps = getLineProps({ line });
                                return (
                                    <div
                                        key={lineIndex}
                                        {...lineProps}
                                        className="flex hover:bg-[#272727]/50 transition-colors"
                                    >
                                        {/* Line number */}
                                        <span
                                            className="select-none pr-4 text-right text-[#717171]"
                                            style={{ width: `${lineNumberWidth + 2}ch` }}
                                        >
                                            {lineIndex + 1}
                                        </span>
                                        {/* Line content */}
                                        <span className="flex-1">
                                            {line.map((token, tokenIndex) => (
                                                <span key={tokenIndex} {...getTokenProps({ token })} />
                                            ))}
                                        </span>
                                    </div>
                                );
                            })}
                        </pre>
                    )}
                </Highlight>
            </div>
        </motion.div>
    );
}
