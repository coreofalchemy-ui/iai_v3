import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const QUICK_PROMPTS = [
    { title: '와인 리스트', description: '이 효과를 따라해서...', icon: '🍷' },
    { title: '커피숍 브랜딩', description: '브랜드 디자이너로서...', icon: '☕' },
    { title: '스토리 보드', description: '스토리보드가 필요합니다...', icon: '🎬' },
];

export default function GeminiChatApp() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userName] = useState('사용자');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Gemini 클라이언트 초기화
    const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || input.trim();
        if (!messageText) return;

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: messageText,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: messageText
            });
            const assistantText = response.text || '응답을 받지 못했습니다.';

            const assistantMessage: Message = {
                id: `msg-${Date.now() + 1}`,
                role: 'assistant',
                content: assistantText,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Gemini API error:', error);
            const errorMessage: Message = {
                id: `msg-${Date.now() + 1}`,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* 헤더 */}
            <header className="h-14 border-b flex items-center justify-between px-6">
                <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800">
                    ← Back
                </button>
                <h1 className="text-lg font-bold text-gray-800">Gemini 3.0 채팅</h1>
                <div className="w-20"></div>
            </header>

            <div className="flex-grow flex">
                {/* 메인 채팅 영역 */}
                <div className="flex-grow flex flex-col">
                    {/* 메시지 목록 */}
                    <div className="flex-grow overflow-y-auto p-6">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mb-6">
                                    <span className="text-white text-2xl">✦</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">안녕하세요 {userName}님,</h2>
                                <p className="text-gray-500 mb-8">오늘 무엇을 만들까요?</p>

                                {/* 퀵 프롬프트 */}
                                <div className="space-y-3 w-full max-w-md">
                                    {QUICK_PROMPTS.map((prompt, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSendMessage(prompt.description)}
                                            className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
                                        >
                                            <div className="text-2xl">{prompt.icon}</div>
                                            <div className="flex-grow">
                                                <div className="font-medium text-gray-800">{prompt.title}</div>
                                                <div className="text-sm text-gray-500 truncate">{prompt.description}</div>
                                            </div>
                                            <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto space-y-6">
                                {messages.map(message => (
                                    <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                                        {message.role === 'assistant' && (
                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-white text-sm">✦</span>
                                            </div>
                                        )}
                                        <div className={`max-w-[80%] p-4 rounded-2xl ${message.role === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                        {message.role === 'user' && (
                                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-gray-600 text-sm">U</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-sm animate-pulse">✦</span>
                                        </div>
                                        <div className="bg-gray-100 p-4 rounded-2xl">
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* 입력 영역 */}
                    <div className="border-t p-4">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex items-center gap-3 bg-gray-100 rounded-2xl p-3">
                                <button className="p-2 text-gray-500 hover:text-gray-700">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                </button>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="아이디어로 시작하거나 '@'을 입력하여 멘션하세요"
                                    className="flex-grow bg-transparent outline-none text-gray-800 placeholder-gray-500"
                                />
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!input.trim() || isLoading}
                                    className={`p-2 rounded-full transition-colors ${input.trim() && !isLoading
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'text-gray-400'
                                        }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
