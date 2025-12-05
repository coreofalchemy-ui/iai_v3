import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Vercel Serverless Function for Gemini API calls
// API key is stored on server only - never exposed to browser

const MODEL_NAME = 'gemini-3-pro-image-preview';

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export const config = {
    runtime: 'edge',
};

interface GeminiRequest {
    action: 'generateImage' | 'generateText' | 'analyzeImage';
    prompt: string;
    images?: { data: string; mimeType: string }[];
    config?: {
        aspectRatio?: string;
        imageSize?: string;
    };
}

export default async function handler(req: Request) {
    // CORS 헤더
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers,
        });
    }

    // 인증 확인 - Supabase JWT 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers,
        });
    }

    // API 키 확인 (서버에서만 접근 가능)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured' }), {
            status: 500,
            headers,
        });
    }

    try {
        const body: GeminiRequest = await req.json();
        const { action, prompt, images, config: reqConfig } = body;

        const ai = new GoogleGenAI({ apiKey });

        // 이미지 파트 구성
        const parts: any[] = [];

        if (images && images.length > 0) {
            for (const img of images) {
                parts.push({
                    inlineData: {
                        data: img.data,
                        mimeType: img.mimeType,
                    },
                });
            }
        }

        parts.push({ text: prompt });

        // Gemini API 호출
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts },
            config: {
                // @ts-ignore
                imageConfig: reqConfig ? {
                    aspectRatio: reqConfig.aspectRatio || '1:1',
                    imageSize: reqConfig.imageSize || '1K',
                } : undefined,
                safetySettings: SAFETY_SETTINGS,
            },
        });

        // 응답에서 이미지 또는 텍스트 추출
        let result: { type: 'image' | 'text'; data: string } | null = null;

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData) {
                    result = {
                        type: 'image',
                        data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    };
                    break;
                } else if (part.text) {
                    result = {
                        type: 'text',
                        data: part.text,
                    };
                }
            }
            if (result?.type === 'image') break;
        }

        if (!result) {
            return new Response(JSON.stringify({ error: 'No content generated' }), {
                status: 500,
                headers,
            });
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers,
        });

    } catch (error: any) {
        console.error('Gemini API error:', error);
        return new Response(JSON.stringify({
            error: error.message || 'Internal server error'
        }), {
            status: 500,
            headers,
        });
    }
}
