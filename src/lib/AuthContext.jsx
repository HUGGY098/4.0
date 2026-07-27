import React, { createContext, useState, useContext, useEffect } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkUserAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;

      if (session?.provider_token) {
        localStorage.setItem(
          "google_calendar_token",
          session.provider_token
        );
      }

      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      const currentUser = session?.user ?? null;

      if (session?.provider_token) {
        localStorage.setItem(
          "google_calendar_token",
          session.provider_token
        );
      }

      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setAuthChecked(true);

    } catch (error) {
      console.error("Auth check failed:", error);

      setAuthError({
        type: "unknown",
        message: error.message || "Authentication failed",
      });

      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };


  const logout = async () => {
    await supabase.auth.signOut();

    setUser(null);
    setIsAuthenticated(false);
  };


  const navigateToLogin = () => {
    window.location.href = "/login";
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authError,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};