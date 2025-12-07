import React from "react";

type Props = {
    x: number;
    y: number;
    visible: boolean;
    isSelected?: boolean;
    isHeld?: boolean;
    isFlipped?: boolean;
    onToggleSelect?: () => void;
    onToggleHold?: () => void;
    onDelete?: () => void;
    onWearShoes?: () => void;
    onGeneratePose?: () => void;
    onGenerateCloseUp?: () => void;
    onChangeColor?: () => void;
    onUndo?: () => void;
    canUndo?: boolean;
    onFlipHorizontal?: () => void;
    hasImage?: boolean;
    onDownload?: () => void;
};

export const SimpleContextMenu: React.FC<Props> = ({
    x,
    y,
    visible,
    isSelected,
    isHeld,
    isFlipped,
    onToggleSelect,
    onToggleHold,
    onDelete,
    onWearShoes,
    onGeneratePose,
    onGenerateCloseUp,
    onChangeColor,
    onUndo,
    canUndo,
    onFlipHorizontal,
    hasImage,
    onDownload,
}) => {
    if (!visible) return null;

    // 공통 스타일
    const menuItemBase = "w-full text-left px-4 py-2.5 flex items-center gap-3 text-[13px] font-medium transition-colors";
    const iconStyle = "w-4 h-4 flex items-center justify-center text-[14px] opacity-70";
    const labelStyle = "flex-1";
    const badgeStyle = "text-[10px] px-1.5 py-0.5 rounded";

    return (
        <div
            className="fixed z-[99999] min-w-[200px] rounded-lg border border-[#333] bg-[#1a1a1a] shadow-2xl py-1"
            style={{ top: y, left: x }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            {/* Model Hold Button */}
            {onToggleHold && (
                <button
                    className={`${menuItemBase} border-b border-[#333] ${isHeld
                        ? 'bg-[#2a2020] text-[#ff6b6b] hover:bg-[#352525]'
                        : 'text-[#ccc] hover:bg-[#252525]'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleHold();
                    }}
                >
                    <span className={iconStyle}>{isHeld ? '◎' : '◉'}</span>
                    <span className={labelStyle}>{isHeld ? '모델 홀드 해제' : '모델 홀드'}</span>
                    {isHeld && <span className={`${badgeStyle} bg-[#ff6b6b20] text-[#ff6b6b]`}>LOCKED</span>}
                </button>
            )}

            {/* Section Selection Button */}
            {onToggleSelect && (
                <button
                    className={`${menuItemBase} border-b border-[#333] ${isSelected
                        ? 'bg-[#1a2a1a] text-[#6bff6b] hover:bg-[#253525]'
                        : 'text-[#ccc] hover:bg-[#252525]'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect();
                    }}
                >
                    <span className={iconStyle}>{isSelected ? '✓' : '○'}</span>
                    <span className={labelStyle}>{isSelected ? '사진해제' : '사진선택'}</span>
                </button>
            )}

            {/* Pose Generation */}
            {onGeneratePose && (
                <button
                    className={`${menuItemBase} border-b border-[#333] text-[#ccc] hover:bg-[#252525]`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onGeneratePose();
                    }}
                >
                    <span className={iconStyle}>⧉</span>
                    <span className={labelStyle}>자세생성</span>
                    <span className={`${badgeStyle} bg-[#ffffff10] text-[#888]`}>Full</span>
                </button>
            )}

            {/* Close Up Generation */}
            {onGenerateCloseUp && (
                <button
                    className={`${menuItemBase} border-b border-[#333] text-[#ccc] hover:bg-[#252525]`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onGenerateCloseUp();
                    }}
                >
                    <span className={iconStyle}>⌘</span>
                    <span className={labelStyle}>클로즈생성</span>
                    <span className={`${badgeStyle} bg-[#ffffff10] text-[#888]`}>Lower</span>
                </button>
            )}

            {/* Shoe Regeneration */}
            {onWearShoes && (
                <button
                    className={`${menuItemBase} border-b border-[#333] text-[#ccc] hover:bg-[#252525]`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onWearShoes();
                    }}
                >
                    <span className={iconStyle}>◇</span>
                    <span className={labelStyle}>신발 재생성</span>
                    <span className={`${badgeStyle} bg-[#ffffff10] text-[#888]`}>AI</span>
                </button>
            )}

            {/* Change Color */}
            {onChangeColor && (
                <button
                    className={`${menuItemBase} border-b border-[#333] text-[#ccc] hover:bg-[#252525]`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onChangeColor();
                    }}
                >
                    <span className={iconStyle}>◐</span>
                    <span className={labelStyle}>색상 변경</span>
                    <span className={`${badgeStyle} bg-[#ffffff10] text-[#888]`}>AI</span>
                </button>
            )}

            {/* Undo */}
            {onUndo && (
                <button
                    className={`${menuItemBase} border-b border-[#333] ${canUndo
                        ? 'text-[#ccc] hover:bg-[#252525]'
                        : 'text-[#555] cursor-not-allowed'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (canUndo) onUndo();
                    }}
                    disabled={!canUndo}
                >
                    <span className={iconStyle}>↺</span>
                    <span className={labelStyle}>되돌리기</span>
                    {!canUndo && <span className={`${badgeStyle} text-[#555]`}>없음</span>}
                </button>
            )}

            {/* Flip Horizontal */}
            {onFlipHorizontal && hasImage && (
                <button
                    className={`${menuItemBase} border-b border-[#333] ${isFlipped
                        ? 'bg-[#1a2a2a] text-[#6bf] hover:bg-[#253535]'
                        : 'text-[#ccc] hover:bg-[#252525]'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onFlipHorizontal();
                    }}
                >
                    <span className={iconStyle}>⇋</span>
                    <span className={labelStyle}>좌우반전</span>
                    {isFlipped && <span className={`${badgeStyle} bg-[#6bf20] text-[#6bf]`}>ON</span>}
                </button>
            )}

            {/* Download */}
            {onDownload && hasImage && (
                <button
                    className={`${menuItemBase} border-b border-[#333] text-[#ccc] hover:bg-[#252525]`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownload();
                    }}
                >
                    <span className={iconStyle}>⬇</span>
                    <span className={labelStyle}>다운로드</span>
                </button>
            )}

            {/* Delete */}
            {onDelete && (
                <button
                    className={`${menuItemBase} text-[#ff6b6b] hover:bg-[#2a2020]`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <span className={iconStyle}>✕</span>
                    <span className={labelStyle}>삭제</span>
                </button>
            )}
        </div>
    );
};
