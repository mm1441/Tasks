import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GoogleAuthService, GoogleAuthTokens, GoogleUserInfo } from '../services/GoogleAuth';

interface GoogleAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userInfo: GoogleUserInfo | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const authService = GoogleAuthService.getInstance();

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      setIsLoading(true);
      const tokens = await authService.loadStoredTokens();
      const authenticated = tokens !== null;
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        // Load stored user info
        const storedUserInfo = await authService.loadStoredUserInfo();
        if (storedUserInfo) {
          setUserInfo(storedUserInfo);
        } else {
          // If we have tokens but no user info, fetch it
          const accessToken = await authService.getAccessToken();
          if (accessToken) {
            const fetchedUserInfo = await authService.fetchUserInfo(accessToken);
            if (fetchedUserInfo) {
              setUserInfo(fetchedUserInfo);
            }
          }
        }
      } else {
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
      setIsAuthenticated(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    try {
      const tokens = await authService.signIn();
      setIsAuthenticated(true);
      const userInfo = authService.getUserInfo();
      setUserInfo(userInfo);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
      setIsAuthenticated(false);
      setUserInfo(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      return await authService.getAccessToken();
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        userInfo,
        signIn,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
  }
  return context;
}
