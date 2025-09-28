import { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '@/services/api';
import socketService from '@/services/socket';

const AuthContext = createContext({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    login: async () => { },
    register: async () => { },
    logout: async () => { },
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const clearUserSessionData = () => {
        // Clear session-specific data stored by previous user
        sessionStorage.removeItem('selectedSessionId'); // Teacher session
        sessionStorage.removeItem('currentStudentSession'); // Student session
        // Clear any other user-specific session data
        // Note: Don't clear localStorage token here as it's handled by apiClient
    };

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                apiClient.setToken(token);
                const response = await apiClient.getCurrentUser();
                setUser(response.user);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (credentials) => {
        try {
            // Clear any previous user's session data before login
            clearUserSessionData();

            // Disconnect any existing socket connection from previous user
            socketService.disconnect();

            const response = await apiClient.login(credentials);
            setUser(response.user);

            // Reconnect socket with new authentication
            socketService.reconnectWithNewAuth();

            return { success: true };
        } catch (error) {
            console.error('Login failed:', error);
            return { success: false, error: error.message };
        }
    };

    const register = async (userData) => {
        try {
            const response = await apiClient.register(userData);
            // Don't set user state on registration - user must login separately
            return { success: true, message: response.message };
        } catch (error) {
            console.error('Registration failed:', error);
            return { success: false, error: error.message };
        }
    };

    const logout = async () => {
        try {
            await apiClient.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear user state and session data
            setUser(null);
            clearUserSessionData();

            // Disconnect socket connection
            socketService.disconnect();
        }
    };

    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};