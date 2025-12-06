import { supabase } from './supabase';

/**
 * 🔐 보안 Gemini API 프록시
 * 
 * 이 모듈은 기존 코드의 GoogleGenAI 호출을 대체합니다.
 * 모든 API 요청은 서버리스 함수(/api/gemini)를 통해 처리되며,
 * API 키는 서버에서만 사용됩니다.
 */

const API_ENDPOINT = '/api/gemini';

export interface GeminiImagePart {
    data: string;
    mimeType: string;
}

export interface GeminiConfig {
    aspectRatio?: string;
    imageSize?: string;
}

export interface GeminiResponse {
    type: 'image' | 'text';
    data: string;
}

/**
 * base64 데이터 URL에서 순수 base64 데이터 추출
 */
export function extractBase64(dataUrl: string): GeminiImagePart {
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
 * Supabase 세션 토큰 가져오기
 */
async function getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        throw new Error('AUTH_ERROR: 로그인이 필요합니다.');
    }
    return session.access_token;
}

/**
 * 🔐 보안 Gemini API 호출
 * 
 * 서버리스 함수를 통해 Gemini API를 호출합니다.
 * API 키는 서버에서만 사용되어 브라우저에 노출되지 않습니다.
 */
export async function callGeminiSecure(
    prompt: string,
    images: GeminiImagePart[] = [],
    config?: GeminiConfig,
    systemInstruction?: string
): Promise<GeminiResponse> {
    // 로컬 개발 시 토큰 스킵
    let token = '';
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalDev) {
        token = await getAuthToken();
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            prompt,
            images,
            config,
            systemInstruction,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
}

/**
 * 이미지 생성 (보안 버전)
 */
export async function generateImageSecure(
    prompt: string,
    referenceImages: string[] = [],
    config?: GeminiConfig
): Promise<string> {
    const images = referenceImages.map(img => extractBase64(img));

    const result = await callGeminiSecure(prompt, images, config);

    if (result.type !== 'image') {
        throw new Error('이미지 생성에 실패했습니다.');
    }

    return result.data;
}

/**
 * 이미지 분석 (보안 버전)
 */
export async function analyzeImageSecure(
    imageUrl: string,
    prompt: string
): Promise<string> {
    const image = extractBase64(imageUrl);

    const result = await callGeminiSecure(prompt, [image]);

    return result.data;
}

/**
 * 텍스트 생성 (보안 버전)
 */
export async function generateTextSecure(
    prompt: string,
    systemInstruction?: string
): Promise<string> {
    const result = await callGeminiSecure(prompt, [], undefined, systemInstruction);
    return result.data;
}

/**
 * 다중 이미지 처리 (보안 버전)
 */
export async function processWithImagesSecure(
    prompt: string,
    imageUrls: string[],
    config?: GeminiConfig,
    systemInstruction?: string
): Promise<GeminiResponse> {
    const images = imageUrls.map(img => extractBase64(img));
    return callGeminiSecure(prompt, images, config, systemInstruction);
}

/**
 * URL에서 이미지 로드 후 base64로 변환
 */
export async function urlToBase64(url: string): Promise<string> {
    if (url.startsWith('data:')) {
        return url.includes('base64,') ? url.split('base64,')[1] : url;
    }

    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.includes('base64,') ? result.split('base64,')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
