
import React from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, ArrowRightIcon, CameraIcon } from './icons';

interface StartScreenProps {
    onStart: () => void;
    hasApiKey: boolean;
    onConnectApiKey: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart, hasApiKey, onConnectApiKey }) => {
    return (
        <div className="relative w-full h-screen bg-[#f8f7f4] flex flex-col items-center justify-center overflow-hidden p-6">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-200 rounded-full blur-[150px]" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="z-10 flex flex-col items-center text-center max-w-3xl"
            >
                <div className="mb-6 p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <CameraIcon className="w-10 h-10 text-gray-800" />
                </div>
                
                <h1 className="text-5xl md:text-7xl font-serif font-medium text-gray-900 mb-6 tracking-tight leading-tight">
                    AI Fashion Studio
                    <br />
                    <span className="text-indigo-600 italic">Campaign VFX</span>
                </h1>
                
                <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-xl font-light leading-relaxed">
                    Gemini 3.0 Pro 기반의 VFX 캠페인 생성기.<br/>
                    <span className="font-medium text-gray-800">신발, 얼굴, 배경 모델</span>을 결합하여<br/>완벽한 9등신 비율의 룩북을 완성하세요.
                </p>

                {!hasApiKey ? (
                    <button 
                        onClick={onConnectApiKey}
                        className="group relative px-8 py-4 bg-gray-900 text-white rounded-full text-lg font-medium hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-3"
                    >
                        <span>Google AI Studio 연결하기</span>
                        <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                ) : (
                     <button 
                        onClick={onStart}
                        className="group relative px-12 py-4 bg-black text-white rounded-full text-xl font-serif hover:bg-gray-800 transition-all shadow-2xl hover:scale-105 flex items-center gap-3"
                    >
                        <SparklesIcon className="w-6 h-6 text-yellow-300" />
                        <span>스튜디오 입장 (Enter Studio)</span>
                    </button>
                )}

                <div className="mt-12 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest font-medium">
                    <span>Powered by Gemini 3.0 Pro Image Preview</span>
                </div>
            </motion.div>
        </div>
    );
};

export default StartScreen;
