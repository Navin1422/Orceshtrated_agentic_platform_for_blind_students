import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth state from localStorage
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(userData);
                setIsAuthenticated(true);
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        
        setIsLoading(false);
    }, []);

    // Login function - ensures token is stored and state is updated before navigation
    const login = async (userData, userRole) => {
        setIsLoading(true);
        
        try {
            // Generate a simple token (in real app, this would come from server)
            const token = `eduvoice-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Store token and user data
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            
            // Update state immediately
            setToken(token);
            setUser(userData);
            setIsAuthenticated(true);
            
            setIsLoading(false);
            
            // Return a promise that resolves when auth state is fully set
            return Promise.resolve({ success: true, token, user: userData });
            
        } catch (error) {
            console.error('Login error:', error);
            setIsLoading(false);
            return Promise.resolve({ success: false, error });
        }
    };

    // Logout function
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
    };

    const value = {
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        setUser,
        setToken
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
