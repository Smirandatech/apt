import App from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export default function AppWrapper() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center h-screen">
          <div className="w-[300px] space-y-4">
            <Skeleton className="h-6 w-1/2 mx-auto" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
