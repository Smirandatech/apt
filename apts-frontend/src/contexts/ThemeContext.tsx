// src/contexts/ThemeContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or system preference
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && (stored === "light" || stored === "dark")) {
      return stored;
    }
    // Check system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load theme preference from backend when user is logged in
  useEffect(() => {
    if (user) {
      api
        .get("/auth/theme")
        .then((res) => {
          const backendTheme = res.data.theme_preference;
          if (backendTheme && (backendTheme === "light" || backendTheme === "dark")) {
            setThemeState(backendTheme);
          }
        })
        .catch(() => {
          // If backend doesn't have preference, keep current theme
          console.log("Could not load theme preference from backend");
        });
    }
  }, [user]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    
    // Save to backend if user is logged in
    if (user) {
      try {
        await api.patch("/auth/theme", { theme_preference: newTheme });
      } catch (error) {
        console.error("Failed to save theme preference to backend:", error);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

