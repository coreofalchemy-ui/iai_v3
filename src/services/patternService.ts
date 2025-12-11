// Pattern Creator Service - AI 기반 신발 패턴 처리
import { GoogleGenAI } from "@google/genai";

// ============ AI 초기화 ============
const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
const MODEL_NAME = 'gemini-2.0-flash-exp';

// Gemini API 호출 래퍼
const callGeminiSecure = async (config: { contents: any[]; generationConfig?: any }) => {
    return await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: config.contents,
        config: config.generationConfig
    });
};


// ============ 타입 정의 ============
export interface RenderedShoe {
    id: string;
    originalUrl: string;
    renderedUrl: string;
    type: 'base' | 'pattern';
    isProcessing?: boolean;
}

export interface GeneratedShoe {
    id: string;
    url: string;
    sourcePatternId: string;
    position: { x: number; y: number };
}

export interface BezierPoint {
    x: number;
    y: number;
    handleIn: { x: number; y: number };
    handleOut: { x: number; y: number };
}

export interface VectorPath {
    id: string;
    points: BezierPoint[];
    style: 'seam' | 'stitch' | 'outline' | 'panel';
    closed: boolean;
    color: string;
}

export interface PatternPiece {
    id: string;
    name: string;
    paths: VectorPath[];
    imageUrl?: string;
}

// ============ 유틸리티 함수 ============
const imageToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.readAsDataURL(blob);
    });
};

const extractImageFromResponse = (response: any): string | null => {
    if (!response?.candidates?.[0]?.content?.parts) return null;
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    }
    return null;
};

// ============ AI 서비스 함수 ============

/**
 * 어떤 각도의 신발이든 측면 뷰로 렌더링 + 누끼
 */
export const renderSideView = async (imageUrl: string): Promise<string> => {
    const imageBase64 = await imageToBase64(imageUrl);

    const prompt = `You are a professional shoe product photographer and 3D rendering expert.

TASK: Transform this shoe image into a perfect SIDE VIEW (lateral profile) with completely transparent/removed background.

REQUIREMENTS:
1. ANGLE: Render the shoe as a perfect side profile view (90 degrees lateral)
   - Show the full length from toe to heel
   - Capture the complete silhouette
   
2. BACKGROUND: Create a clean, transparent background (pure white if transparency not possible)
   - No shadows, no reflections, no floor
   - Clean cutout (누끼) quality
   
3. QUALITY: 
   - Maintain all original textures, materials, stitching details
   - High resolution, sharp edges
   - Professional product photography quality

4. LIGHTING: Even, soft lighting that shows all details without harsh shadows

Generate this professionally rendered side-view shoe image.`;

    const response = await callGeminiSecure({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['image', 'text']
        }
    });

    const resultImage = extractImageFromResponse(response);
    if (!resultImage) throw new Error('측면뷰 렌더링 실패');
    return resultImage;
};

/**
 * 베이스 신발에 패턴 신발의 패턴/소재 적용
 */
export const applyPattern = async (
    baseShoeUrl: string,
    patternShoeUrl: string
): Promise<string> => {
    const baseBase64 = await imageToBase64(baseShoeUrl);
    const patternBase64 = await imageToBase64(patternShoeUrl);

    const prompt = `You are an expert shoe designer specializing in pattern and material application.

TASK: Apply the pattern/material from the SECOND shoe to the FIRST shoe's design.

FIRST IMAGE (BASE SHOE): This is the base shoe whose SHAPE, SILHOUETTE, and STITCHING STRUCTURE you must preserve.

SECOND IMAGE (PATTERN SOURCE): Extract the MATERIAL, PATTERN, COLOR, and TEXTURE from this shoe.

REQUIREMENTS:
1. PRESERVE from base shoe:
   - Exact shoe shape and silhouette
   - All stitch lines and seam positions
   - Panel divisions and construction
   - Sole design
   
2. APPLY from pattern source:
   - Material/fabric type
   - Color and pattern
   - Surface texture
   
3. OUTPUT:
   - Side view, clean transparent background
   - Professional rendering quality
   - Realistic material application following the base shoe's panel structure

Generate this new shoe design.`;

    const response = await callGeminiSecure({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: baseBase64 } },
                    { inlineData: { mimeType: 'image/png', data: patternBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['image', 'text']
        }
    });

    const resultImage = extractImageFromResponse(response);
    if (!resultImage) throw new Error('패턴 적용 실패');
    return resultImage;
};

/**
 * 신발 이미지를 편집 가능한 벡터 패스 형태로 변환
 * (AI가 스티치/재봉선/패널을 분석하여 SVG 패스 데이터 반환)
 */
export const renderVectorPaths = async (imageUrl: string): Promise<{
    paths: VectorPath[];
    backgroundImage: string;
}> => {
    const imageBase64 = await imageToBase64(imageUrl);

    const prompt = `You are a shoe pattern engineer and technical illustrator.

TASK: Analyze this shoe image and identify ALL stitching lines, seams, and panel divisions.

OUTPUT FORMAT (JSON):
{
  "paths": [
    {
      "id": "path_1",
      "style": "seam|stitch|outline|panel",
      "color": "#000000",
      "closed": true/false,
      "points": [
        {"x": 0-1000, "y": 0-1000, "handleIn": {"x": 0, "y": 0}, "handleOut": {"x": 0, "y": 0}},
        ...
      ]
    }
  ]
}

REQUIREMENTS:
1. Identify EVERY visible:
   - Stitch line (dashed path, style: "stitch")
   - Seam/edge between panels (solid line, style: "seam") 
   - Outer shoe silhouette (style: "outline")
   - Individual panels/sections (style: "panel")

2. Use Bezier curve points with control handles for smooth curves
3. Coordinates normalized to 0-1000 range
4. Include appropriate colors for each path type

Return ONLY the JSON, no other text.`;

    const response = await callGeminiSecure({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['text']
        }
    });

    // JSON 파싱
    let paths: VectorPath[] = [];
    try {
        const textContent = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            paths = parsed.paths || [];
        }
    } catch (e) {
        console.error('Vector paths parsing failed:', e);
        // 기본 패스 생성
        paths = [
            {
                id: 'outline_1',
                style: 'outline',
                color: '#333333',
                closed: true,
                points: [
                    { x: 100, y: 500, handleIn: { x: 0, y: 0 }, handleOut: { x: 50, y: -100 } },
                    { x: 300, y: 300, handleIn: { x: -50, y: 50 }, handleOut: { x: 50, y: -50 } },
                    { x: 700, y: 250, handleIn: { x: -100, y: 0 }, handleOut: { x: 100, y: 0 } },
                    { x: 900, y: 400, handleIn: { x: 0, y: -50 }, handleOut: { x: 0, y: 50 } },
                    { x: 800, y: 600, handleIn: { x: 50, y: -50 }, handleOut: { x: -50, y: 50 } },
                    { x: 200, y: 650, handleIn: { x: 100, y: 0 }, handleOut: { x: -50, y: 0 } },
                ]
            }
        ];
    }

    return { paths, backgroundImage: imageUrl };
};

/**
 * 편집된 벡터 패스를 자연스러운 사진으로 복원
 */
export const pathsToPhoto = async (
    paths: VectorPath[],
    originalImageUrl: string
): Promise<string> => {
    const imageBase64 = await imageToBase64(originalImageUrl);

    // SVG 패스 문자열 생성
    const pathsDescription = paths.map(p =>
        `${p.style} path with ${p.points.length} points, color: ${p.color}, ${p.closed ? 'closed' : 'open'}`
    ).join('\n');

    const prompt = `You are a professional shoe renderer.

TASK: Render this shoe with the MODIFIED stitch/seam lines as described below.

ORIGINAL SHOE IMAGE: [Attached]

MODIFIED PATHS:
${pathsDescription}

REQUIREMENTS:
1. Keep the original shoe's materials and colors
2. Apply the new stitch/seam line positions naturally
3. Render photorealistically with clean background
4. Maintain professional product photography quality

Generate the modified shoe image.`;

    const response = await callGeminiSecure({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['image', 'text']
        }
    });

    const resultImage = extractImageFromResponse(response);
    if (!resultImage) throw new Error('사진 복원 실패');
    return resultImage;
};

/**
 * 신발 이미지에서 라스트 반게이지 패턴 도면 추출
 * 
 * 출력 형태:
 * - 라스트(신발골) 반게이지 아웃라인
 * - 그 위에 신발의 모든 패턴/스티치/패널 라인 표기
 * - 제조용 기술 도면 스타일
 */
export const extractPattern = async (imageUrl: string): Promise<string> => {
    const imageBase64 = await imageToBase64(imageUrl);

    const prompt = `You are a professional SHOE PATTERN TECHNICIAN (신발 패턴 기술자).

Your task is to convert this shoe photo into a LAST HALF-GAUGE PATTERN DRAWING (라스트 반게이지 도면).

═══════════════════════════════════════════════════════════════
WHAT IS A LAST HALF-GAUGE PATTERN?
═══════════════════════════════════════════════════════════════

A Last Half-Gauge is a technical drawing showing:
- The SIDE PROFILE OUTLINE of a shoe last (라스트 측면 아웃라인)
- All PATTERN LINES, SEAMS, and STITCH DETAILS drawn ON TOP of this outline
- It shows how the shoe upper "wraps" around the last

Think of it as "flattening" the shoe onto the last silhouette while preserving all design details.

═══════════════════════════════════════════════════════════════
OUTPUT DRAWING SPECIFICATIONS
═══════════════════════════════════════════════════════════════

DRAW THIS EXACT FORMAT:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                          ←── COLLAR LINE (칼라라인)             │
│                    ╭─────────────╮                              │
│                   ╱               ╲                             │
│      QUARTER    ╱     VAMP AREA    ╲    ← EYELET HOLES         │
│       PANEL   ╱        갑피         ╲      (아이렛)             │
│              │                       │                          │
│              │    [Pattern lines     │                          │
│              │     from the shoe     │                          │
│              │     go here]          │                          │
│              │                       │                          │
│     HEEL    │                        │    TOE BOX              │
│    COUNTER  │                        │     토박스               │
│     힐카운터 ╲                      ╱                           │
│               ╲                    ╱                            │
│                ╲──────────────────╱                             │
│                 └────────────────┘                              │
│                    OUTSOLE LINE (아웃솔 라인)                   │
│                                                                 │
│                                           A-270mm~349mm         │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
STEP-BY-STEP INSTRUCTIONS
═══════════════════════════════════════════════════════════════

STEP 1: Draw the LAST OUTLINE (라스트 아웃라인)
- Draw the classic shoe last side profile shape
- Toe pointed left, heel on right
- Show the bump for toe box, curve for instep, heel rise
- This is the OUTER BOUNDARY

STEP 2: Analyze the shoe photo for DESIGN ELEMENTS
- Identify every visible SEAM LINE (봉제선)
- Identify every STITCH LINE (스티치 라인)
- Identify PANEL DIVISIONS (패널 분할)
- Note decorative elements, logos, texture changes

STEP 3: PROJECT all lines onto the Last Half-Gauge
- Draw every seam/stitch line from the shoe photo
- Place them where they would appear on the last profile
- Use correct line types:
  ─────── Solid = Panel edge / Cutting line (재단선)
  - - - - Dashed = Stitch line (스티치 라인)
  ∙∙∙∙∙∙∙ Dotted = Hidden line / Fold (접는선)

STEP 4: Add TOPLINE and COLLAR
- Draw the top opening of the shoe (발목 라인)
- This curves from heel to tongue area

STEP 5: Mark SIZE and SEAM ALLOWANCE
- Add "A-270mm~349mm" in corner
- Note "재봉미미: 5mm" if applicable

═══════════════════════════════════════════════════════════════
LINE STYLE REQUIREMENTS
═══════════════════════════════════════════════════════════════

• BLACK lines on WHITE background
• CLEAN technical drawing style
• NO color, NO gradients, NO shading
• Line weights:
  - Last outline: 2pt thick
  - Panel lines: 1pt
  - Stitch lines: 0.5pt dashed
  - Hidden lines: 0.5pt dotted

═══════════════════════════════════════════════════════════════
IMPORTANT
═══════════════════════════════════════════════════════════════

- Copy EXACTLY the pattern/stitch layout from the shoe photo
- Every curve, every line must match the original design
- The output should look like the professional pattern drawings used in Korean shoe factories
- Include the last shape as the containing outline

NOW GENERATE THE LAST HALF-GAUGE PATTERN DRAWING FOR THIS SHOE.`;

    const response = await callGeminiSecure({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['image', 'text']
        }
    });

    const resultImage = extractImageFromResponse(response);
    if (!resultImage) throw new Error('패턴 추출 실패');
    return resultImage;
};

/**
 * 개별 부위 패턴 추출 (특정 부위만)
 */
export const extractComponentPattern = async (
    imageUrl: string,
    componentName: 'vamp' | 'quarter' | 'tongue' | 'heel' | 'outsole'
): Promise<string> => {
    const imageBase64 = await imageToBase64(imageUrl);

    const componentNames = {
        vamp: 'VAMP (갑피/앞코) - The front upper piece covering the instep and toe',
        quarter: 'QUARTER (쿼터/뒤축) - Side panels from heel to vamp',
        tongue: 'TONGUE (설포/혀) - The piece under the laces',
        heel: 'HEEL COUNTER (힐 카운터) - Back heel reinforcement piece',
        outsole: 'OUTSOLE (아웃솔) - The bottom sole pattern'
    };

    const prompt = `You are a shoe pattern engineer.

Extract ONLY the ${componentNames[componentName]} pattern from this shoe.

OUTPUT: A single flat 2D pattern piece with:
- Solid cutting line
- Dashed seam allowance (3-5mm)
- Dotted stitch lines if any
- Grain line arrow (↕)
- Notch markers (▽)
- Part name label

Style: Clean black lines on white background, CAD technical drawing.`;

    const response = await callGeminiSecure({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['image', 'text']
        }
    });

    const resultImage = extractImageFromResponse(response);
    if (!resultImage) throw new Error(`${componentName} 패턴 추출 실패`);
    return resultImage;
};

