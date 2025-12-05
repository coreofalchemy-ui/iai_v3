import React from 'react';
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { RedX } from './Scribbles';

const DATA = [
    { name: 'A', val: 20 },
    { name: 'B', val: 45 },
    { name: 'C', val: 30 },
    { name: 'D', val: 70 },
    { name: 'E', val: 55 },
    { name: 'F', val: 65 },
    { name: 'G', val: 80 },
];

const BAR_DATA = [
    { name: '1', val: 30 },
    { name: '2', val: 50 },
    { name: '3', val: 20 },
    { name: '4', val: 60 },
];

const FALLBACK_IMAGES: Record<string, string> = {
    "default": "https://images.unsplash.com/photo-1550614000-4b9519e0037a?auto=format&fit=crop&w=800&q=80&v=4"
};

export const TrendChart: React.FC = () => {
    return (
        <div className="w-full h-full bg-[#1a1a1a] p-3 flex flex-col justify-between relative overflow-hidden group">

            <div className="flex flex-col h-full justify-between transition-opacity duration-300 group-hover:opacity-0">
                <div className="flex justify-between items-start mb-2 z-10">
                    <div>
                        <div className="text-[10px] text-gray-400 font-mono">DASHBOARD_V.03</div>
                        <div className="text-white font-bold text-sm tracking-wider">SEASONAL FORECAST</div>
                    </div>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                </div>

                <div className="flex gap-2 h-32">
                    <div className="flex-grow bg-[#222] border border-gray-700 p-1 relative" style={{ minWidth: '100px', minHeight: '100px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={DATA}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="val" stroke="#8884d8" fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1 right-1 text-[8px] text-purple-400">GROWTH +12%</div>
                    </div>

                    <div className="w-1/4 flex flex-col gap-1">
                        <div className="h-full bg-[#222] border border-gray-700 p-1" style={{ minWidth: '50px', minHeight: '100px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={BAR_DATA}>
                                    <Bar dataKey="val" fill="#d00000" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-2">
                    <div className="w-12 h-12 rounded-full border-2 border-purple-500 flex items-center justify-center relative">
                        <div className="text-[8px] text-white">84%</div>
                        <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
                    </div>
                    <div className="flex flex-col justify-center">
                        <div className="h-1 w-20 bg-gray-700 rounded overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-red-500 w-2/3"></div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-2 right-2 text-[8px] text-gray-500 font-mono">AI_MODEL_GEN_2.5</div>
            </div>

            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 bg-black">
                <img
                    src="https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80&v=4"
                    alt="Trend Realized"
                    className="w-full h-full object-cover opacity-80"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_IMAGES['default'];
                    }}
                />
                <div className="absolute inset-0 bg-black/20"></div>
                <RedX className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-80" />
                <div className="absolute bottom-4 left-4 bg-black text-white px-2 py-1 text-xs font-bold border border-white">TREND MATCH: 98%</div>
            </div>

        </div>
    );
};
