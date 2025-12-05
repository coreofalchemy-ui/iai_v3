import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import DetailGeneratorApp from './apps/detail-generator/DetailGeneratorApp';
import LandingPage from './pages/landing/LandingPage';
import ContentGeneratorApp from './apps/content-generator/ContentGeneratorApp';
import SketchEditorApp from './apps/sketch-editor/SketchEditorApp';
import ModelGeneratorApp from './apps/model-generator/ModelGeneratorApp';
import GeminiChatApp from './apps/gemini-chat/GeminiChatApp';

// 인증이 필요한 라우트를 감싸는 컴포넌트
function ProtectedRoutes() {
    const { user, loading, signOut } = useAuth();

    // 로딩 중
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">로딩 중...</p>
                </div>
            </div>
        );
    }

    // 로그인 안 됨 → 로그인 페이지
    if (!user) {
        return <LoginPage />;
    }

    // 로그인 됨 → 앱 라우터
    return (
        <>
            {/* 로그아웃 버튼 (고정) */}
            <button
                onClick={() => signOut()}
                className="fixed top-4 right-4 z-[9999] px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-medium rounded-lg border border-white/20 transition-all"
                title="로그아웃"
            >
                👤 {user.email?.split('@')[0]} | 로그아웃
            </button>

            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/detail-generator" element={<DetailGeneratorApp />} />
                <Route path="/content-generator" element={<ContentGeneratorApp />} />
                <Route path="/sketch-editor" element={<SketchEditorApp />} />
                <Route path="/model-generator" element={<ModelGeneratorApp />} />
                <Route path="/gemini-chat" element={<GeminiChatApp />} />
            </Routes>
        </>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <ProtectedRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
