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
    temperature?: number;
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
// Mock Image with Generic Error Message
const MOCK_ERROR_IMAGE = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMTIwMCIgdmlld0JveD0iMCAwIDgwMCAxMjAwIiBmaWxsPSJub25lIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjEyMDAiIGZpbGw9IiNmM2Y0ZjYiLz4KICA8dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiMzNzQxNTEiPkFQSSBFcnJvcjwvdGV4dD4KICA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2YjcyODAiPlNlcnZlciBjb25uZWN0aW9uIGZhaWxlZCAoNTAwKTwvdGV4dD4KICA8dGV4dCB4PSI1MCUiIHk9IjU1JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2YjcyODAiPlJldHVybmluZyBNb2NrIERhdGE8L3RleHQ+Cjwvc3ZnPg==`;

// Mock JSON Response
const MOCK_ERROR_JSON = JSON.stringify({
    error: "Mock Data due to API Error",
    analysisResult: {
        heroCopy: { productName: "Mock Product", brandLine: "Mock Brand" },
        specs: {},
        heelHeight: "3cm",
        heightSpec: { outsole: "3cm", insole: "1cm", total: "4cm" }
    }
});

/**
 * 이미지 최적화 (사이즈 줄임 - 더 공격적으로)
 */
async function optimizeImage(base64Str: string, maxWidth = 800): Promise<string> {
    // 이미 최적화된 경우 건너뛰기 (약 200KB 이하면 패스)
    if (base64Str.length < 250000) return base64Str;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // JPEG 포맷으로 변환하여 용량 대폭 감소 (Quality 0.7)
                const optimized = canvas.toDataURL('image/jpeg', 0.7);
                resolve(optimized.split('base64,')[1]);
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
        img.src = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;
    });
}

/**
 * 🔐 보안 Gemini API 호출
 */
export async function callGeminiSecure(
    prompt: string,
    images: GeminiImagePart[] = [],
    config?: GeminiConfig,
    systemInstruction?: string
): Promise<GeminiResponse> {
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

    // 이미지 최적화 적용
    const optimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        data: await optimizeImage(img.data)
    })));

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            prompt,
            images: optimizedImages,
            config,
            systemInstruction,
        }),
    });

    if (!response.ok) {
        // Handle Errors Gracefully
        if ([429, 503, 500, 504].includes(response.status)) {
            console.warn(`⚠️ Gemini API Error (${response.status}). Returning Mock Data.`);

            // JSON 요청인지 확인 (prompt나 config로 추론)
            const isJsonRequest = prompt.includes('JSON') || (config as any)?.responseMimeType === 'application/json';

            if (isJsonRequest) {
                return {
                    type: 'text', // JSON은 텍스트로 리턴
                    data: MOCK_ERROR_JSON
                };
            }

            return {
                type: 'image',
                data: MOCK_ERROR_IMAGE
            };
        }

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

/**
 * URL에서 이미지 로드 후 base64로 변환
 */
export async function urlToBase64(url: string): Promise<string> {
    const part = await urlToGeminiPart(url);
    return part.data;
}

/**
 * URL에서 이미지 로드 후 GeminiImagePart로 변환 (mimeType 포함)
 */
export async function urlToGeminiPart(url: string): Promise<GeminiImagePart> {
    if (url.startsWith('data:')) {
        const mimeType = url.split(';')[0].split(':')[1];
        const data = url.includes('base64,') ? url.split('base64,')[1] : url;
        return { data, mimeType };
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const data = result.includes('base64,') ? result.split('base64,')[1] : result;
            resolve({ data, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

