import React from 'react';
import { SparklesIcon } from './Icons';

interface PoseChangerProps {
  poses: { label: string; prompt: string }[];
  onPoseSelect: (prompt: string) => void;
  onGenerateRandom: () => void;
  disabled: boolean;
  isGenerating: boolean;
}

export const PoseChanger: React.FC<PoseChangerProps> = ({ 
  poses, 
  onPoseSelect, 
  onGenerateRandom, 
  disabled, 
  isGenerating 
}) => {

  return (
    <div className="border border-dashed border-gray-700 rounded-lg p-4 bg-gray-800/20">
      <div className="space-y-2">
        {poses.map((pose) => (
          <button
            key={pose.prompt}
            onClick={() => onPoseSelect(pose.prompt)}
            disabled={disabled}
            className={`w-full text-xs font-medium text-left p-3 rounded-md transition-colors duration-200 border
              ${disabled
                ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'
              }`}
          >
            {pose.label}
          </button>
        ))}
      </div>
      
      <button
          onClick={onGenerateRandom}
          disabled={disabled || isGenerating}
          className={`w-full mt-4 text-xs font-bold p-3 rounded-lg transition-all border flex items-center justify-center
            ${disabled || isGenerating
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-900/50 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900 hover:text-white'
            }`}
        >
           <SparklesIcon className="w-3 h-3 mr-2"/>
           {isGenerating ? 'AI가 포즈 생성 중...' : '랜덤 포즈 생성 (AI RANDOM)'}
        </button>
    </div>
  );
};