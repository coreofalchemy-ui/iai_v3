import { supabase } from './supabase';

/**
 * 서버사이드 Gemini API 호출 클라이언트
 * API 키는 서버에만 있고, 브라우저에서는 절대 접근 불가
 */

interface GeminiImagePart {
    data: string; // base64 (prefix 제외)
    mimeType: string;
}

interface GeminiRequest {
    action: 'generateImage' | 'generateText' | 'analyzeImage';
    prompt: string;
    images?: GeminiImagePart[];
    config?: {
        aspectRatio?: string;
        imageSize?: string;
    };
}

interface GeminiResponse {
    type: 'image' | 'text';
    data: string;
}

// API 엔드포인트 (Vercel 배포 시 자동으로 /api/gemini로 매핑)
const API_ENDPOINT = '/api/gemini';

/**
 * base64 데이터 URL에서 prefix 제거
 */
function stripBase64Prefix(dataUrl: string): { data: string; mimeType: string } {
    if (dataUrl.includes('base64,')) {
        const [prefix, data] = dataUrl.split('base64,');
        const mimeMatch = prefix.match(/data:([^;]+)/);
        return {
            data,
            mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
        };
    }
    return { data: dataUrl, mimeType: 'image/png' };
}

/**
 * 서버사이드 Gemini API 호출
 */
export async function callGeminiAPI(request: GeminiRequest): Promise<GeminiResponse> {
    // 현재 세션에서 JWT 토큰 가져오기
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
    }

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
}

/**
 * 이미지 생성 (편의 함수)
 */
export async function generateImage(
    prompt: string,
    referenceImages: string[] = [],
    config?: { aspectRatio?: string; imageSize?: string }
): Promise<string> {
    const images = referenceImages.map(img => stripBase64Prefix(img));

    const result = await callGeminiAPI({
        action: 'generateImage',
        prompt,
        images,
        config,
    });

    if (result.type !== 'image') {
        throw new Error('이미지 생성에 실패했습니다.');
    }

    return result.data;
}

/**
 * 이미지 분석 (편의 함수)
 */
export async function analyzeImage(
    imageUrl: string,
    prompt: string
): Promise<string> {
    const { data, mimeType } = stripBase64Prefix(imageUrl);

    const result = await callGeminiAPI({
        action: 'analyzeImage',
        prompt,
        images: [{ data, mimeType }],
    });

    if (result.type !== 'text') {
        throw new Error('이미지 분석에 실패했습니다.');
    }

    return result.data;
}

/**
 * 텍스트 생성 (편의 함수)
 */
export async function generateText(prompt: string): Promise<string> {
    const result = await callGeminiAPI({
        action: 'generateText',
        prompt,
    });

    return result.data;
}
