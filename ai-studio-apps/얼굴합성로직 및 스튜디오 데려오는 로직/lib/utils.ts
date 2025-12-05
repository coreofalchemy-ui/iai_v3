
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFriendlyErrorMessage(error: unknown, context: string): string {
    let rawMessage = '알 수 없는 오류가 발생했습니다.';
    
    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'string') {
        rawMessage = error;
    } else if (error) {
        rawMessage = String(error);
    }

    // Handle specific API errors
    if (rawMessage.includes("429") || rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("quota")) {
        return `API 사용량이 초과되었습니다. (Quota Exceeded). 결제 계정이 연결된 API 키인지 확인해주세요.`;
    }

    if (rawMessage.includes("API key not valid") || rawMessage.includes("API_KEY_INVALID")) {
        return `API 키가 유효하지 않습니다. 다시 연결해주세요.`;
    }

    if (rawMessage.includes("Unsupported MIME type")) {
        return `지원되지 않는 파일 형식입니다. PNG, JPEG, WEBP 형식을 사용해주세요.`;
    }
    
    // Clean up generic Google API error wrapper if present
    if (rawMessage.includes("GoogleGenAIError")) {
        const match = rawMessage.match(/message\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
            return `${context}: ${match[1]}`;
        }
    }

    return `${context}: ${rawMessage.slice(0, 100)}${rawMessage.length > 100 ? '...' : ''}`;
}
