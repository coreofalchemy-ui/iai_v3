import React from 'react';

export default function Spinner() {
    return (
        <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-600"></div>
            <p className="text-sm text-gray-600 font-medium">AI 생성 중...</p>
        </div>
    );
}
