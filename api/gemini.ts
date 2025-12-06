import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Serverless Function - API 키는 서버에서만 접근 가능
// 브라우저에서는 절대 볼 수 없음

const MODEL_NAME = 'gemini-3-pro-image-preview';

interface GeminiRequestBody {
    prompt: string;
    images?: { data: string; mimeType: string }[];
    config?: {
        aspectRatio?: string;
        imageSize?: string;
    };
    systemInstruction?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 인증 확인 (Supabase JWT) - 로컬 개발 시 스킵
    const isLocalDev = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1');
    if (!isLocalDev) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    // 서버 전용 API 키 (VITE_ 없으므로 브라우저에서 접근 불가)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY not configured');
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const body: GeminiRequestBody = req.body;
        const { prompt, images, config: reqConfig, systemInstruction } = body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Google AI SDK 동적 import
        const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = await import('@google/genai');

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

        // Safety settings
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];

        // Gemini API 호출
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts },
            config: {
                // @ts-ignore - imageConfig는 타입에 없지만 동작함
                imageConfig: reqConfig ? {
                    aspectRatio: reqConfig.aspectRatio || '1:1',
                    imageSize: reqConfig.imageSize || '1K',
                } : undefined,
                systemInstruction: systemInstruction,
                safetySettings,
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
            return res.status(500).json({ error: 'No content generated' });
        }

        return res.status(200).json(result);

    } catch (error: any) {
        console.error('Gemini API error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}
