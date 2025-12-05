/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ShirtIcon, RotateCcwIcon, HistoryIcon } from './icons';

interface HeaderProps {
  onBackToStart?: () => void;
  onOpenChangelog?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onBackToStart, onOpenChangelog }) => {
  return (
    <header className="w-full py-5 px-4 md:px-8 bg-white sticky top-0 z-40 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
          <ShirtIcon className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">
            AI 상세페이지 생성기
          </h1>
      </div>
      <div className="flex items-center gap-3">
        {onOpenChangelog && (
            <button
                onClick={onOpenChangelog}
                className="flex items-center justify-center text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors px-4 py-2 rounded-lg"
            >
                <HistoryIcon className="w-4 h-4 mr-2" />
                업데이트 기록
            </button>
        )}
        {onBackToStart && (
          <button
            onClick={onBackToStart}
            className="flex items-center justify-center text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors px-4 py-2 rounded-lg"
          >
            <RotateCcwIcon className="w-4 h-4 mr-2" />
            새로 시작하기
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;