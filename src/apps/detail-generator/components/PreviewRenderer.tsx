import React, { useEffect } from 'react';
import { RefreshCwIcon, Trash2Icon, CopyIcon, PlusIcon, MinusIcon } from './icons';

export interface TextElement {
    id: string;
    sectionId: string; // The section this text belongs to
    content: string;
    top: number;
    left: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right';
}

interface PreviewRendererProps {
    htmlContent: string;
    textElements: TextElement[];
    overlays?: any[];
    onAction?: (action: string, type: any, index: any, arg?: any) => void;
    onZoom?: (key: string, direction: string) => void;
    interactive?: boolean;
    // Handlers for interactive mode
    onTextMouseDown?: (e: React.MouseEvent, textId: string) => void;
    onResizeMouseDown?: (e: React.MouseEvent, textId: string) => void;
    onTextChange?: (textId: string, content: string) => void;
    contentRef?: React.RefObject<HTMLDivElement>;
    onContextMenu?: (e: React.MouseEvent, type: string, index: number, section: string) => void;
    isDragging?: boolean;
}

export const PreviewRenderer: React.FC<PreviewRendererProps> = ({
    htmlContent,
    textElements,
    overlays = [],
    onAction,
    onZoom,
    interactive = false,
    onTextMouseDown,
    onResizeMouseDown,
    onTextChange,
    contentRef,
    onContextMenu,
    isDragging = false
}) => {
    return (
        <div className="relative w-full h-full">
            <style>{`
                @keyframes pulse-border {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .drop-zone {
                    min-height: 600px !important;
                }
                img[data-gallery-type] {
                    margin: 0 !important;
                    display: block !important;
                }
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&display=swap');
                @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/css/SpoqaHanSansNeo.css');
            `}</style>

            <div ref={contentRef} className="relative w-[1000px] bg-white shadow-2xl min-h-[1000px]" dangerouslySetInnerHTML={{ __html: htmlContent }} />

            {/* Text Elements */}
            {textElements.map(text => (
                <div
                    key={text.id}
                    data-text-id={text.id}
                    className={`absolute ${interactive ? 'border-2 border-black bg-black/5' : ''}`}
                    style={{
                        top: text.top,
                        left: text.left,
                        width: text.width,
                        height: text.height,
                        zIndex: 9999,
                        cursor: interactive ? 'grab' : 'default',
                        pointerEvents: interactive ? 'auto' : 'none'
                    }}
                    onMouseDown={(e) => interactive && onTextMouseDown?.(e, text.id)}
                >
                    <textarea
                        value={text.content}
                        onChange={(e) => interactive && onTextChange?.(text.id, e.target.value)}
                        className="w-full h-full bg-transparent border-0 outline-none resize-none p-2"
                        style={{
                            fontSize: text.fontSize,
                            fontFamily: text.fontFamily,
                            cursor: interactive ? 'text' : 'default',
                            pointerEvents: interactive ? 'auto' : 'none'
                        }}
                        placeholder={interactive ? "텍스트 입력..." : ""}
                        readOnly={!interactive}
                        onClick={(e) => e.stopPropagation()}
                    />
                    {/* Resize handle - only visible in interactive mode */}
                    {interactive && (
                        <div
                            className="absolute bottom-0 right-0 w-4 h-4 bg-black cursor-nwse-resize"
                            onMouseDown={(e) => onResizeMouseDown?.(e, text.id)}
                        />
                    )}
                </div>
            ))}

            {/* Overlays - only visible in interactive mode */}
            {interactive && overlays.map((o, i) => (
                <div
                    key={i}
                    className={`absolute z-20 cursor-context-menu ${interactive && isDragging ? 'pointer-events-none' : ''}`}
                    style={{ top: o.top, left: o.left, width: o.width, height: o.height }}
                    data-overlay-type={o.type}
                    data-overlay-index={o.index}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onContextMenu?.(e, o.type, o.index, o.type);
                    }}
                />
            ))}
        </div>
    );
};
