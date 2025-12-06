/**
 * Layout Import Types
 * 레이아웃 가져오기 기능을 위한 타입 정의
 */

// ==================== Core Types ====================

// 챕터 분리 결과
export interface ImportedChapter {
    id: string;
    crop: { top: number; bottom: number };  // 원본 이미지에서의 위치 (px)
    imageUrl: string;                        // 잘라낸 챕터 이미지 (base64 또는 blob URL)
    height: number;                          // 잘라낸 높이
}

// 블록 타입
export type BlockType = 'imageSlot' | 'text';
export type TextStyle = 'title' | 'body' | 'caption';
export type TextAlign = 'left' | 'center' | 'right';

// 이미지 슬롯 블록
export interface ImageSlotBlock {
    type: 'imageSlot';
    slotId: string;
    bbox: { x: number; y: number; width: number; height: number };  // 퍼센트 (0-100)
    aspectRatio: string;  // "16:9", "4:3", "1:1" 등
    currentImageUrl?: string;  // 사용자가 채운 이미지
    isGenerated?: boolean;     // AI 생성 여부
}

// 텍스트 블록
export interface TextBlock {
    type: 'text';
    blockId: string;
    style: TextStyle;
    align: TextAlign;
    initialText: string;
    currentText: string;  // 편집 후 텍스트
    bbox: { x: number; y: number; width: number; height: number };  // 퍼센트 (0-100)
}

export type LayoutBlock = ImageSlotBlock | TextBlock;

// 챕터별 레이아웃
export interface ChapterLayout {
    id: string;
    chapterIndex: number;
    originalChapterImageUrl: string;  // 원본 챕터 이미지 (레퍼런스용)
    blocks: LayoutBlock[];
    backgroundColor?: string;
    width: number;
    height: number;
}

// 전체 임포트 상태
export interface LayoutImportState {
    originalImageUrl: string | null;        // 업로드된 전체 이미지
    originalImageWidth: number;
    originalImageHeight: number;
    chapters: ImportedChapter[];            // 분리된 챕터들
    chapterLayouts: ChapterLayout[];        // 분석된 레이아웃들
    selectedChapterId: string | null;       // 현재 선택된 챕터
    isProcessing: boolean;
    processingStep: 'idle' | 'splitting' | 'analyzing' | 'done';
    processingProgress: number;             // 0-100
    error: string | null;
}

// 초기 상태
export const initialLayoutImportState: LayoutImportState = {
    originalImageUrl: null,
    originalImageWidth: 0,
    originalImageHeight: 0,
    chapters: [],
    chapterLayouts: [],
    selectedChapterId: null,
    isProcessing: false,
    processingStep: 'idle',
    processingProgress: 0,
    error: null,
};
