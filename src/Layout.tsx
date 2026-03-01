import React, { type FC, type ReactNode } from "react";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import "katex/dist/katex.min.css";

interface LayoutProps {
  children: ReactNode;
  currentPageName?: string;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="eureka-theme">
      <div className="h-screen overflow-hidden bg-[#F9FAFB] dark:bg-gray-900">
        <style>{`
          :root {
            --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          body {
            font-family: var(--font-sans);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* Custom scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          
          ::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 4px;
            border: 2px solid transparent;
            background-clip: content-box;
          }
          .dark ::-webkit-scrollbar-thumb {
            background: #4b5563;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
            background-clip: content-box;
          }
          .dark ::-webkit-scrollbar-thumb:hover {
            background: #6b7280;
          }
          
          /* Focus styles — preserve accessibility ring on keyboard navigation */
          *:focus-visible {
            outline: 2px solid #14b8a6;
            outline-offset: 2px;
          }

          input:focus, textarea:focus, select:focus {
            outline: none !important;
            box-shadow: none !important;
          }
          
          /* Theme transitions — scoped to elements that actually change on theme toggle.
             The old wildcard * rule caused scrollbar jank and 60fps layout thrash. */
          body,
          .dark body,
          [class*="bg-"],
          [class*="text-"],
          [class*="border-"] {
            transition-property: background-color, border-color, color;
            transition-duration: 200ms;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          /* Reduced motion */
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>
        {children}
      </div>
    </ThemeProvider>
  );
};

export default Layout;
