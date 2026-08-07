// src/components/Header.tsx
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, LogOut, LogIn, Briefcase, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleAuthClick = () => {
    if (user) {
      logout();
      navigate("/login");
    } else {
      navigate("/login");
    }
  };

  const roleColor =
    user?.role === "admin"
      ? "text-red-500"
      : user?.role === "developer"
      ? "text-blue-500"
      : user?.role === "manager"
      ? "text-amber-600 dark:text-amber-400"
      : "text-green-500";

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full px-6 py-3 border-b bg-gradient-to-r from-indigo-50 via-white to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 backdrop-blur-lg flex items-center justify-between sticky top-0 z-50 shadow-sm"
    >
      {/* Logo / App Name */}
      <div
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-2xl font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity"
      >
        <Briefcase className="w-6 h-6 text-primary" />
        <span className="tracking-tight">apts</span>
      </div>

      {/* Right side: theme toggle + user + auth */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="flex items-center justify-center"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        {user && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
            <span className={`text-xs font-semibold ${roleColor}`}>
              {user.role}
            </span>
          </div>
        )}

        <Button
          variant={user ? "outline" : "default"}
          onClick={handleAuthClick}
          className="flex items-center gap-2"
        >
          {user ? (
            <>
              <LogOut className="w-4 h-4" />
              Logout
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Login
            </>
          )}
        </Button>
      </div>
    </motion.header>
  );
}
