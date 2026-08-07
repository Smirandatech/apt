// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import { Toaster } from "sonner";
import AppWrapper from "@/components/AppWrapper";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppWrapper />
        <Toaster richColors/>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
