"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { CodeBlock } from "./CodeBlock";
import { BookOpen, Sparkles, Download, ChevronDown, FileCode, FileText } from "lucide-react";

interface TutorialCardProps {
    content: string;
}

export function TutorialCard({ content }: TutorialCardProps) {
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);

    const handleExportMarkdown = () => {
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tutorial-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExportOpen(false);
    };

    const handleExportPDF = async () => {
        setIsExportOpen(false);
        setPdfGenerating(true);

        try {
            const { jsPDF } = await import("jspdf");
            const doc = new jsPDF();

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const maxWidth = pageWidth - margin * 2;
            let y = margin;

            // Helper function to strip markdown syntax from text
            const stripMarkdown = (text: string): string => {
                return text
                    // Remove links [text](url) -> text
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    // Remove bold **text** or __text__ -> text
                    .replace(/\*\*([^*]+)\*\*/g, '$1')
                    .replace(/__([^_]+)__/g, '$1')
                    // Remove italic *text* or _text_ -> text
                    .replace(/\*([^*]+)\*/g, '$1')
                    .replace(/_([^_]+)_/g, '$1')
                    // Remove inline code `code` -> code
                    .replace(/`([^`]+)`/g, '$1')
                    // Remove strikethrough ~~text~~ -> text
                    .replace(/~~([^~]+)~~/g, '$1');
            };

            // Helper to check and add new page
            const checkNewPage = (neededHeight: number = 10) => {
                if (y + neededHeight > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            };

            let inCodeBlock = false;
            let codeBlockLanguage = "";
            let codeBlockLines: string[] = [];

            const renderCodeBlock = () => {
                if (codeBlockLines.length === 0) return;

                const codeMaxWidth = maxWidth - 16;

                // Calculate code block height
                doc.setFontSize(9);
                doc.setFont("courier", "normal");
                let codeHeight = 16; // Top padding with header
                for (const codeLine of codeBlockLines) {
                    const splitCode = doc.splitTextToSize(codeLine || " ", codeMaxWidth);
                    codeHeight += splitCode.length * 5;
                }
                codeHeight += 8; // Bottom padding

                // Check if code block fits on current page
                checkNewPage(codeHeight);

                const startY = y;

                // Draw code block background (dark theme)
                doc.setFillColor(30, 35, 45);
                doc.setDrawColor(60, 70, 90);
                doc.roundedRect(margin, y, maxWidth, codeHeight, 3, 3, 'FD');

                // Draw left accent bar
                doc.setFillColor(56, 189, 248); // cyan-400
                doc.rect(margin, y, 3, codeHeight, 'F');

                y += 4;

                // Draw language label
                if (codeBlockLanguage) {
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(148, 163, 184); // slate-400
                    doc.text(codeBlockLanguage.toUpperCase(), margin + 10, y + 4);
                    y += 10;
                } else {
                    y += 6;
                }

                // Draw code content
                doc.setFontSize(9);
                doc.setFont("courier", "normal");
                doc.setTextColor(226, 232, 240); // slate-200

                for (const codeLine of codeBlockLines) {
                    const splitCode = doc.splitTextToSize(codeLine || " ", codeMaxWidth);
                    for (const textLine of splitCode) {
                        doc.text(textLine, margin + 10, y);
                        y += 5;
                    }
                }

                y = startY + codeHeight + 8; // Move past the code block with spacing
                doc.setTextColor(0, 0, 0);
                codeBlockLines = [];
            };

            // Helper to render text with inline code styling
            const renderTextWithInlineCode = (text: string, xStart: number, fontSize: number, textColor: [number, number, number], availableWidth: number) => {
                // First, strip other markdown but keep inline code markers for processing
                let processedText = text
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    .replace(/\*\*([^*]+)\*\*/g, '$1')
                    .replace(/__([^_]+)__/g, '$1')
                    .replace(/\*([^*]+)\*/g, '$1')
                    .replace(/_([^_]+)_/g, '$1')
                    .replace(/~~([^~]+)~~/g, '$1');

                // Check if text contains inline code
                const hasInlineCode = /`[^`]+`/.test(processedText);

                if (!hasInlineCode) {
                    // No inline code, render normally
                    const cleanText = processedText.replace(/`([^`]+)`/g, '$1');
                    doc.setFontSize(fontSize);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...textColor);
                    const splitText = doc.splitTextToSize(cleanText, availableWidth);
                    for (const textLine of splitText) {
                        checkNewPage(6);
                        doc.text(textLine, xStart, y);
                        y += fontSize * 0.55;
                    }
                    return;
                }

                // Has inline code - render segment by segment
                // First, get the full text without backticks for line wrapping calculation
                const fullCleanText = processedText.replace(/`([^`]+)`/g, '$1');
                const wrappedLines = doc.splitTextToSize(fullCleanText, availableWidth);

                for (const wrappedLine of wrappedLines) {
                    checkNewPage(8);

                    // Find which parts of the original text correspond to this wrapped line
                    // For simplicity, we'll render the whole line and then overlay inline code styling

                    // Parse the line for inline code segments
                    const parts: { text: string; isCode: boolean }[] = [];
                    let remaining = processedText;
                    let lineTextAccum = "";

                    while (remaining.length > 0) {
                        const codeMatch = remaining.match(/^`([^`]+)`/);
                        const textMatch = remaining.match(/^[^`]+/);

                        if (codeMatch) {
                            parts.push({ text: codeMatch[1], isCode: true });
                            remaining = remaining.slice(codeMatch[0].length);
                        } else if (textMatch) {
                            parts.push({ text: textMatch[0], isCode: false });
                            remaining = remaining.slice(textMatch[0].length);
                        } else {
                            break;
                        }
                    }

                    // Render each part
                    let currentX = xStart;
                    for (const part of parts) {
                        if (part.isCode) {
                            // Render inline code with background
                            doc.setFont("courier", "normal");
                            doc.setFontSize(fontSize - 1);
                            const codeWidth = doc.getTextWidth(part.text) + 3;

                            // Draw background
                            doc.setFillColor(40, 45, 55);
                            doc.roundedRect(currentX - 1, y - 3.5, codeWidth + 2, 5, 1, 1, 'F');

                            // Draw text
                            doc.setTextColor(86, 199, 248); // cyan
                            doc.text(part.text, currentX + 1, y);
                            currentX += codeWidth + 2;
                        } else {
                            // Render normal text
                            doc.setFont("helvetica", "normal");
                            doc.setFontSize(fontSize);
                            doc.setTextColor(...textColor);
                            doc.text(part.text, currentX, y);
                            currentX += doc.getTextWidth(part.text);
                        }
                    }

                    y += fontSize * 0.55;

                    // Only process the first wrapped line - complex multi-line inline code is too hard
                    // For subsequent lines, fall back to simple rendering
                    processedText = ""; // Clear to prevent re-processing
                }
            };


            const lines = content.split('\n');
            let listIndentLevel = 0;

            for (let i = 0; i < lines.length; i++) {
                // Trim carriage returns that might be left from Windows line endings
                const line = lines[i].replace(/\r$/, '');

                // Check if we need a new page
                if (!inCodeBlock) {
                    checkNewPage(10);
                }

                // Handle code block markers - check for ``` at start (with possible language)
                const isCodeBlockMarker = line.trim().startsWith('```');

                if (isCodeBlockMarker) {
                    if (!inCodeBlock) {
                        inCodeBlock = true;
                        codeBlockLanguage = line.trim().replace(/^```/, '').trim();
                        codeBlockLines = [];
                    } else {
                        inCodeBlock = false;
                        renderCodeBlock();
                        codeBlockLanguage = "";
                    }
                    continue;
                }

                if (inCodeBlock) {
                    codeBlockLines.push(line);
                    continue;
                }

                // Handle headings
                if (line.startsWith('# ')) {
                    y += 8;
                    checkNewPage(16);
                    doc.setFontSize(22);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(20, 25, 35);
                    const text = stripMarkdown(line.replace('# ', ''));
                    const splitText = doc.splitTextToSize(text, maxWidth);
                    for (const textLine of splitText) {
                        doc.text(textLine, margin, y);
                        y += 9;
                    }
                    // Underline
                    doc.setDrawColor(56, 189, 248);
                    doc.setLineWidth(0.8);
                    doc.line(margin, y, margin + 40, y);
                    doc.setLineWidth(0.2);
                    y += 6;
                } else if (line.startsWith('## ')) {
                    y += 6;
                    checkNewPage(12);
                    doc.setFontSize(16);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(30, 40, 55);
                    const text = stripMarkdown(line.replace('## ', ''));
                    const splitText = doc.splitTextToSize(text, maxWidth);
                    for (const textLine of splitText) {
                        doc.text(textLine, margin, y);
                        y += 7;
                    }
                    y += 3;
                } else if (line.startsWith('### ')) {
                    y += 4;
                    checkNewPage(10);
                    doc.setFontSize(13);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(50, 60, 75);
                    const text = stripMarkdown(line.replace('### ', ''));
                    const splitText = doc.splitTextToSize(text, maxWidth);
                    for (const textLine of splitText) {
                        doc.text(textLine, margin, y);
                        y += 6;
                    }
                    y += 2;
                } else if (line.startsWith('#### ')) {
                    y += 3;
                    checkNewPage(8);
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(60, 70, 85);
                    const text = stripMarkdown(line.replace('#### ', ''));
                    doc.text(text, margin, y);
                    y += 6;
                } else if (line.trim() === '') {
                    y += 4;
                } else if (/^\d+\.\s/.test(line)) {
                    // Numbered list
                    const match = line.match(/^(\d+)\.\s(.*)$/);
                    if (match) {
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(56, 189, 248);
                        doc.text(match[1] + ".", margin, y);

                        // Render list content with inline code support
                        const startY = y;
                        renderTextWithInlineCode(match[2], margin + 10, 10, [50, 55, 65], maxWidth - 12);
                        if (y === startY) y += 5; // Ensure some movement if no content
                        y += 1;
                    }
                } else if (line.match(/^(\s*)[-*]\s/)) {
                    // Bullet points with indentation support
                    const indentMatch = line.match(/^(\s*)/);
                    const indent = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
                    const bulletX = margin + (indent * 6);

                    doc.setFontSize(10);
                    doc.setTextColor(56, 189, 248);
                    doc.text("•", bulletX, y);

                    // Render bullet content with inline code support
                    const bulletContent = line.replace(/^\s*[-*]\s/, '');
                    const startY = y;
                    renderTextWithInlineCode(bulletContent, bulletX + 6, 10, [50, 55, 65], maxWidth - 12 - (indent * 6));
                    if (y === startY) y += 5;
                    y += 1;
                } else if (line.startsWith('>')) {
                    // Blockquote
                    checkNewPage(12);
                    const quoteText = stripMarkdown(line.replace(/^>\s*/, ''));
                    const splitText = doc.splitTextToSize(quoteText, maxWidth - 16);

                    const quoteHeight = splitText.length * 5 + 6;

                    // Draw left border
                    doc.setFillColor(167, 139, 250); // purple-400
                    doc.rect(margin, y - 3, 3, quoteHeight, 'F');

                    // Draw background
                    doc.setFillColor(245, 243, 255); // purple-50
                    doc.rect(margin + 3, y - 3, maxWidth - 3, quoteHeight, 'F');

                    doc.setFontSize(10);
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(100, 90, 120);
                    for (const textLine of splitText) {
                        doc.text(textLine, margin + 10, y);
                        y += 5;
                    }
                    y += 4;
                } else {
                    // Regular paragraph text with inline code support
                    if (line.trim()) {
                        renderTextWithInlineCode(line, margin, 10, [45, 50, 60], maxWidth);
                        y += 2;
                    }
                }
            }

            // Handle any remaining code block
            if (inCodeBlock && codeBlockLines.length > 0) {
                renderCodeBlock();
            }

            doc.save(`tutorial-${new Date().toISOString().slice(0, 10)}.pdf`);

        } catch (error) {
            console.error("PDF generation failed", error);
        } finally {
            setPdfGenerating(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-4xl mx-auto"
        >
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#272727]">
                    <BookOpen className="h-5 w-5 text-[#ff0000]" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-white">Generated Tutorial</h2>
                    <p className="text-sm text-[#aaaaaa]">AI-powered documentation</p>
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-full bg-[#272727] px-3 py-1">
                        <Sparkles className="h-3.5 w-3.5 text-[#ff0000]" />
                        <span className="text-xs font-medium text-[#aaaaaa]">AI Generated</span>
                    </div>

                    {/* Export Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            disabled={pdfGenerating}
                            className="flex items-center gap-2 rounded-full bg-[#272727] px-4 py-2 text-sm text-[#aaaaaa] transition-colors hover:bg-[#3f3f3f] hover:text-white disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />
                            <span>{pdfGenerating ? "Exporting..." : "Export"}</span>
                            <ChevronDown className={`h-3 w-3 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                            {isExportOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl bg-[#212121] p-1 shadow-xl border border-[#303030]"
                                >
                                    <div className="px-2 py-1.5 text-xs font-medium text-[#717171] uppercase tracking-wider">
                                        Download As
                                    </div>
                                    <button
                                        onClick={handleExportMarkdown}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#aaaaaa] hover:bg-[#272727] hover:text-white transition-colors text-left"
                                    >
                                        <FileCode className="h-4 w-4 text-[#3ea6ff]" />
                                        Markdown (.md)
                                    </button>
                                    <div className="my-1 h-px bg-[#303030]" />
                                    <button
                                        onClick={handleExportPDF}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#aaaaaa] hover:bg-[#272727] hover:text-white transition-colors text-left"
                                    >
                                        <FileText className="h-4 w-4 text-[#ff0000]" />
                                        PDF Document
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Content Card */}
            <div className="overflow-hidden rounded-xl bg-[#212121] border border-[#303030]">
                <div className="border-b border-[#303030] bg-[#181818] px-6 py-4">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#717171]" />
                        <span className="text-sm text-[#aaaaaa]">tutorial.md</span>
                    </div>
                </div>

                <div id="tutorial-content" className="prose prose-invert max-w-none px-6 py-8">
                    <ReactMarkdown
                        components={{
                            h1: ({ children }) => (
                                <h1 className="mb-6 border-b border-[#303030] pb-4 text-3xl font-bold text-white">
                                    {children}
                                </h1>
                            ),
                            h2: ({ children }) => (
                                <h2 className="mb-4 mt-8 text-2xl font-semibold text-white">
                                    {children}
                                </h2>
                            ),
                            h3: ({ children }) => (
                                <h3 className="mb-3 mt-6 text-xl font-medium text-[#f1f1f1]">
                                    {children}
                                </h3>
                            ),
                            p: ({ children }) => (
                                <p className="mb-4 leading-relaxed text-[#aaaaaa]">{children}</p>
                            ),
                            ul: ({ children }) => (
                                <ul className="mb-4 list-disc space-y-2 pl-6 text-[#aaaaaa]">
                                    {children}
                                </ul>
                            ),
                            ol: ({ children }) => (
                                <ol className="mb-4 list-decimal space-y-2 pl-6 text-[#aaaaaa]">
                                    {children}
                                </ol>
                            ),
                            li: ({ children }) => (
                                <li className="leading-relaxed">{children}</li>
                            ),
                            code: ({ className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || "");
                                const isInline = !match;
                                const codeString = String(children).replace(/\n$/, "");

                                if (isInline) {
                                    return (
                                        <code
                                            className="rounded bg-[#272727] px-1.5 py-0.5 font-mono text-sm text-[#3ea6ff]"
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                }

                                return (
                                    <CodeBlock code={codeString} language={match?.[1] || "plaintext"} />
                                );
                            },
                            pre: ({ children }) => <>{children}</>,
                            strong: ({ children }) => (
                                <strong className="font-semibold text-white">{children}</strong>
                            ),
                            a: ({ href, children }) => (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#3ea6ff] hover:underline"
                                >
                                    {children}
                                </a>
                            ),
                            blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-[#ff0000] bg-[#1a1a1a] py-2 pl-4 italic text-[#aaaaaa]">
                                    {children}
                                </blockquote>
                            ),
                            hr: () => <hr className="my-8 border-[#303030]" />,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </motion.div>
    );
}

