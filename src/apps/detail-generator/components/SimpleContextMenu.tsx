import React from "react";

type Props = {
    x: number;
    y: number;
    visible: boolean;
    isSelected?: boolean;
    isHeld?: boolean;
    onToggleSelect?: () => void;
    onToggleHold?: () => void;
    onDelete?: () => void;
    onWearShoes?: () => void;
    onGeneratePose?: () => void;
    onGenerateCloseUp?: () => void;
    onChangeColor?: () => void;
    onUndo?: () => void;
    canUndo?: boolean;
};

export const SimpleContextMenu: React.FC<Props> = ({
    x,
    y,
    visible,
    isSelected,
    isHeld,
    onToggleSelect,
    onToggleHold,
    onDelete,
    onWearShoes,
    onGeneratePose,
    onGenerateCloseUp,
    onChangeColor,
    onUndo,
    canUndo,
}) => {
    if (!visible) return null;

    return (
        <div
            className="fixed z-[99999] min-w-[180px] rounded-xl border border-slate-200 bg-white shadow-2xl text-sm py-1"
            style={{ top: y, left: x }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            {/* Model Hold Button - At the very top */}
            {onToggleHold && (
                <button
                    className={`w-full text-left px-4 py-2.5 font-semibold flex items-center gap-2 border-b border-gray-100 ${isHeld
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'hover:bg-orange-50 text-orange-600'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleHold();
                    }}
                >
                    <span>{isHeld ? '🔓' : '🔒'}</span>
                    <span>{isHeld ? '모델 홀드 해제' : '모델 홀드'}</span>
                    {isHeld && <span className="ml-auto text-xs text-red-500">LOCKED</span>}
                </button>
            )}
            {/* Section Selection Button */}
            {onToggleSelect && (
                <button
                    className={`w-full text-left px-4 py-2.5 font-semibold flex items-center gap-2 border-b border-gray-100 ${isSelected
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'hover:bg-gray-50 text-gray-700'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect();
                    }}
                >
                    <span>{isSelected ? '✅' : '☑️'}</span>
                    <span>{isSelected ? '사진해제' : '사진선택'}</span>
                    {isSelected && <span className="ml-auto text-xs text-green-500">편집 가능</span>}
                </button>
            )}
            {/* Pose Generation Buttons */}
            {onGeneratePose && (
                <button
                    className="w-full text-left px-4 py-2.5 hover:bg-purple-50 text-purple-600 font-semibold flex items-center gap-2 border-b border-gray-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        onGeneratePose();
                    }}
                >
                    <span>🧍</span>
                    <span>자세생성</span>
                    <span className="ml-auto text-xs text-purple-400">Full Body</span>
                </button>
            )}
            {onGenerateCloseUp && (
                <button
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-indigo-600 font-semibold flex items-center gap-2 border-b border-gray-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        onGenerateCloseUp();
                    }}
                >
                    <span>👠</span>
                    <span>클로즈생성</span>
                    <span className="ml-auto text-xs text-indigo-400">Lower Body</span>
                </button>
            )}
            {onWearShoes && (
                <button
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-blue-600 font-semibold flex items-center gap-2 border-b border-gray-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        onWearShoes();
                    }}
                >
                    <span>👟</span>
                    <span>신발 착용 (AI)</span>
                </button>
            )}
            {onChangeColor && (
                <button
                    className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-pink-600 font-semibold flex items-center gap-2 border-b border-gray-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        onChangeColor();
                    }}
                >
                    <span>🎨</span>
                    <span>색상 변경</span>
                    <span className="ml-auto text-xs text-pink-400">AI Color</span>
                </button>
            )}
            {/* Undo Button - 되돌리기 */}
            {onUndo && (
                <button
                    className={`w-full text-left px-4 py-2.5 font-semibold flex items-center gap-2 border-b border-gray-100 ${canUndo
                            ? 'hover:bg-yellow-50 text-yellow-600'
                            : 'opacity-50 cursor-not-allowed text-gray-400'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (canUndo) onUndo();
                    }}
                    disabled={!canUndo}
                >
                    <span>↩️</span>
                    <span>되돌리기</span>
                    {!canUndo && <span className="ml-auto text-xs text-gray-400">없음</span>}
                </button>
            )}
            {onDelete && (
                <button
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <span>🗑️</span>
                    <span>삭제</span>
                </button>
            )}
        </div>
    );
};

