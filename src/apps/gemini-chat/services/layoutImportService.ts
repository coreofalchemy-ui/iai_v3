/**
 * Layout Import Service
 * 레이아웃 가져오기 기능을 위한 Vision API 서비스
 */

import { callGeminiSecure, extractBase64 } from '../../../lib/geminiClient';
import type {
    ImportedChapter,
    ChapterLayout,
    LayoutBlock,
    ImageSlotBlock,
    TextBlock
} from '../types/layoutImportTypes';

/**
 * 이미지를 캔버스에서 잘라내기
 */
export async function cropImageSection(
    imageUrl: string,
    top: number,
    bottom: number,
    imageWidth: number
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const height = bottom - top;
            canvas.width = imageWidth;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            ctx.drawImage(img, 0, top, imageWidth, height, 0, 0, imageWidth, height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
    });
}

/**
 * 1. 챕터 자동 분리
 * Vision 모델로 이미지를 분석하여 자연스러운 경계에서 챕터 분리
 */
export async function splitIntoChapters(
    imageBase64: string,
    imageHeight: number
): Promise<{ top: number; bottom: number; description: string }[]> {
    const prompt = `이 이미지는 온라인 쇼핑몰의 긴 상세페이지 캡쳐입니다.

위에서 아래로 분석하여 자연스러운 섹션/챕터 경계를 찾아주세요.

분리 규칙:
1. 큰 여백, 구분선, 배경색이 크게 바뀌는 지점에서 분리
2. 제품 이미지나 배너 중간은 절대 자르지 않기
3. 타이틀/헤더가 새로 시작되는 지점에서 분리
4. 각 섹션은 최소 200px 이상 높이

이미지의 전체 높이는 ${imageHeight}px 입니다.

JSON 형식으로만 응답 (다른 텍스트 없이):
{
  "sections": [
    { "top": 0, "bottom": 800, "description": "히어로 배너 섹션" },
    { "top": 800, "bottom": 1600, "description": "제품 상세 섹션" }
  ]
}`;

    try {
        const result = await callGeminiSecure(prompt, [extractBase64(imageBase64)]);

        // JSON 추출 (코드 블록 제거)
        let jsonStr = result.data;
        if (jsonStr.includes('```')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(jsonStr.trim());
        return parsed.sections || [];
    } catch (error) {
        console.error('챕터 분리 실패:', error);
        throw new Error('챕터 분리에 실패했습니다. 이미지를 다시 확인해주세요.');
    }
}

/**
 * 2. 챕터별 레이아웃 분석
 * Vision 모델로 각 챕터의 이미지/텍스트 블록 추출
 */
export async function analyzeChapterLayout(
    chapterImageBase64: string,
    chapterId: string,
    chapterWidth: number,
    chapterHeight: number
): Promise<ChapterLayout> {
    const prompt = `이 이미지는 상세페이지의 한 섹션입니다.

이미지 안의 모든 요소를 블록 단위로 분석해주세요:

1. 이미지 영역: 제품 사진, 배너, 일러스트 등
2. 텍스트 영역: 제목(title), 본문(body), 캡션(caption)

각 블록의 대략적인 위치(bbox)와 정렬(left/center/right)도 분석.
bbox 좌표는 이미지 크기 대비 퍼센트(0-100)로 표현해주세요.

JSON 형식으로만 응답 (다른 텍스트 없이):
{
  "backgroundColor": "#FFFFFF",
  "blocks": [
    { 
      "type": "image", 
      "bbox": { "x": 0, "y": 0, "width": 100, "height": 60 },
      "aspectRatio": "16:9"
    },
    { 
      "type": "text", 
      "style": "title", 
      "align": "center",
      "text": "제목 텍스트",
      "bbox": { "x": 10, "y": 65, "width": 80, "height": 10 }
    }
  ]
}`;

    try {
        const result = await callGeminiSecure(prompt, [extractBase64(chapterImageBase64)]);

        // JSON 추출
        let jsonStr = result.data;
        if (jsonStr.includes('```')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(jsonStr.trim());

        // 블록 변환
        const blocks: LayoutBlock[] = (parsed.blocks || []).map((block: any, idx: number) => {
            if (block.type === 'image') {
                return {
                    type: 'imageSlot',
                    slotId: `slot-${chapterId}-${idx}`,
                    bbox: block.bbox || { x: 0, y: 0, width: 100, height: 50 },
                    aspectRatio: block.aspectRatio || '1:1',
                } as ImageSlotBlock;
            } else {
                return {
                    type: 'text',
                    blockId: `text-${chapterId}-${idx}`,
                    style: block.style || 'body',
                    align: block.align || 'left',
                    initialText: block.text || '',
                    currentText: block.text || '',
                    bbox: block.bbox || { x: 0, y: 0, width: 100, height: 10 },
                } as TextBlock;
            }
        });

        return {
            id: chapterId,
            chapterIndex: parseInt(chapterId.split('-')[1]) || 0,
            originalChapterImageUrl: chapterImageBase64,
            blocks,
            backgroundColor: parsed.backgroundColor || '#FFFFFF',
            width: chapterWidth,
            height: chapterHeight,
        };
    } catch (error) {
        console.error('레이아웃 분석 실패:', error);
        // 기본 레이아웃 반환
        return {
            id: chapterId,
            chapterIndex: parseInt(chapterId.split('-')[1]) || 0,
            originalChapterImageUrl: chapterImageBase64,
            blocks: [
                {
                    type: 'imageSlot',
                    slotId: `slot-${chapterId}-0`,
                    bbox: { x: 0, y: 0, width: 100, height: 100 },
                    aspectRatio: '1:1',
                } as ImageSlotBlock,
            ],
            backgroundColor: '#FFFFFF',
            width: chapterWidth,
            height: chapterHeight,
        };
    }
}

/**
 * 3. 레퍼런스 기반 이미지 생성
 * 원본 챕터 스타일을 참고하여 새 이미지 생성
 */
export async function generateImageFromReference(
    referenceImageBase64: string,
    slotAspectRatio: string,
    textContext: { title?: string; body?: string; caption?: string },
    productImageBase64?: string
): Promise<string> {
    const images = [extractBase64(referenceImageBase64)];
    if (productImageBase64) {
        images.push(extractBase64(productImageBase64));
    }

    const prompt = `이 이미지는 패션 상세페이지의 한 섹션입니다.

참조 이미지의 전체적인 톤, 색감, 레이아웃, 스타일을 최대한 비슷하게 유지하면서
새로운 이미지를 생성해주세요.

${productImageBase64 ? '두 번째 이미지의 제품을 사용하세요.' : ''}

텍스트 컨텍스트:
${textContext.title ? `- 제목: ${textContext.title}` : ''}
${textContext.body ? `- 본문: ${textContext.body}` : ''}
${textContext.caption ? `- 캡션: ${textContext.caption}` : ''}

이미지 비율: ${slotAspectRatio}

중요: 이미지 안에 큰 텍스트는 넣지 마세요. 텍스트는 별도로 렌더링됩니다.`;

    const result = await callGeminiSecure(prompt, images, { aspectRatio: slotAspectRatio });

    if (result.type !== 'image') {
        throw new Error('이미지 생성에 실패했습니다.');
    }

    return `data:image/png;base64,${result.data}`;
}

/**
 * 4. 이미지 미화 (기존 파이프라인 연결)
 * Studio Minimal, Natural, Cinematic 등 효과 적용
 */
export async function enhanceImage(
    imageBase64: string,
    style: 'studio' | 'natural' | 'cinematic' = 'studio'
): Promise<string> {
    const stylePrompts = {
        studio: 'professional studio lighting, clean white background, product photography style, sharp details',
        natural: 'natural daylight, soft shadows, lifestyle product shot, warm tones',
        cinematic: 'dramatic lighting, moody atmosphere, cinematic color grading, high contrast',
    };

    const prompt = `이 제품 이미지를 다음 스타일로 개선해주세요:
${stylePrompts[style]}

원본 제품의 형태, 디테일, 색상은 정확히 유지하면서
조명과 배경만 개선하세요.`;

    const result = await callGeminiSecure(prompt, [extractBase64(imageBase64)]);

    if (result.type !== 'image') {
        throw new Error('이미지 미화에 실패했습니다.');
    }

    return `data:image/png;base64,${result.data}`;
}

/**
 * 전체 파이프라인: 이미지 업로드 → 챕터 분리 → 레이아웃 분석
 */
export async function processDetailPageImage(
    imageBase64: string,
    imageWidth: number,
    imageHeight: number,
    onProgress?: (step: string, progress: number) => void
): Promise<{ chapters: ImportedChapter[]; layouts: ChapterLayout[] }> {
    const chapters: ImportedChapter[] = [];
    const layouts: ChapterLayout[] = [];

    // 1. 챕터 분리
    onProgress?.('splitting', 10);
    const sections = await splitIntoChapters(imageBase64, imageHeight);

    // 2. 각 챕터 이미지 자르기 및 분석
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const progress = 20 + (i / sections.length) * 70;
        onProgress?.('analyzing', progress);

        // 챕터 이미지 자르기
        const chapterId = `chapter-${i}`;
        const chapterImageUrl = await cropImageSection(
            imageBase64,
            section.top,
            section.bottom,
            imageWidth
        );

        const chapter: ImportedChapter = {
            id: chapterId,
            crop: { top: section.top, bottom: section.bottom },
            imageUrl: chapterImageUrl,
            height: section.bottom - section.top,
        };
        chapters.push(chapter);

        // 레이아웃 분석
        const layout = await analyzeChapterLayout(
            chapterImageUrl,
            chapterId,
            imageWidth,
            section.bottom - section.top
        );
        layouts.push(layout);
    }

    onProgress?.('done', 100);
    return { chapters, layouts };
}
