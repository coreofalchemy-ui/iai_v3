import React from 'react';
import { CameraIcon, SparklesIcon } from './Icons';

export const Header: React.FC = () => (
  <header className="bg-gray-950/90 backdrop-blur-md sticky top-0 z-20 border-b border-gray-800">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-20">
        <div className="flex items-center">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg mr-3 shadow-lg shadow-indigo-500/20">
            <CameraIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              AI Fashion Studio <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Pro</span>
            </h1>
            <p className="text-xs text-gray-400 tracking-wider font-medium">Precision Shoe Swap System</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-xs font-medium text-gray-500 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
            <SparklesIcon className="w-3 h-3 text-yellow-500" />
            <span>Gemini 3.0 Pro Optimized</span>
        </div>
      </div>
    </div>
  </header>
);