import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 로컬 개발 환경 체크
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 개발용 가짜 유저
const devUser: User = {
    id: 'dev-user-123',
    email: 'dev@localhost.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { name: '개발자' },
} as User;

const devSession: Session = {
    access_token: 'dev-token',
    refresh_token: 'dev-refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: devUser,
} as Session;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(isDev ? devSession : null);
    const [user, setUser] = useState<User | null>(isDev ? devUser : null);
    const [loading, setLoading] = useState(!isDev);

    useEffect(() => {
        // 개발 환경에서는 인증 스킵
        if (isDev) {
            console.log('🔓 개발 모드: 인증 우회됨');
            return;
        }

        // 현재 세션 가져오기
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 세션 변경 구독
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error: error as Error | null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
