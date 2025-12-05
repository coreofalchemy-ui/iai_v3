
import React, { useState, useEffect } from 'react';

const loadingSteps = [
  { text: "제품 디테일 정밀 스캔", detail: "신발의 스티치, 박음질, 로고 위치를 픽셀 단위로 분석합니다..." },
  { text: "텍스처 원본 1:1 복제 (Cloning)", detail: "원본 제품 사진의 가죽 질감과 패턴을 그대로 복사합니다" },
  { text: "3D 지오메트리 & 핏 매핑", detail: "모델의 발 모양에 맞춰 신발의 형태를 정밀하게 합성합니다" },
  { text: "빛 반사 & 그림자 계산", detail: "스튜디오 조명을 적용하여 이질감 없는 결과물을 생성합니다" },
  { text: "초고화질 렌더링 & 배경 확장", detail: "1:1 비율로 배경을 확장하고 디테일을 선명하게 마무리합니다" },
];

export const Loader: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 3000); 

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
      <div className="w-full max-w-md p-8 relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] animate-pulse"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative mb-8">
                <div className="w-20 h-20 border-t-2 border-r-2 border-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-b-2 border-l-2 border-purple-500 rounded-full animate-spin [animation-direction:reverse]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">MACRO</span>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">
                {loadingSteps[stepIndex].text}
            </h3>
            <p className="text-indigo-300 text-sm font-medium tracking-wide uppercase animate-pulse">
                {loadingSteps[stepIndex].detail}
            </p>

            <div className="w-full bg-gray-800 h-1 mt-8 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-[loading_2s_ease-in-out_infinite] w-1/3"></div>
            </div>
            
            <p className="mt-4 text-xs text-gray-500">
                Gemini 3.0 Pro Micro-Texture Engine
            </p>
        </div>
      </div>
      <style>{`
        @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};
