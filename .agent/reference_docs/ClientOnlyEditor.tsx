import { useEffect, useState } from "react";

/**
 * Client-Only Editor Wrapper
 * 
 * Bu component SSR'da minimal HTML döndürür, 
 * client-side mount olduktan sonra gerçek editor'ü render eder.
 * 
 * Böylece hydration mismatch problemi tamamen ortadan kalkar.
 */

interface ClientOnlyEditorProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientOnlyEditor({ 
  children, 
  fallback = <EditorLoadingFallback /> 
}: ClientOnlyEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Component mount olduktan sonra editor'ü göster
    setIsMounted(true);
  }, []);

  // SSR ve ilk render'da fallback göster
  if (!isMounted) {
    return <>{fallback}</>;
  }

  // Client-side'da gerçek editor'ü göster
  return <>{children}</>;
}

/**
 * Loading Fallback Component
 * Bu SSR'da render edilir ve browser'a gider
 */
function EditorLoadingFallback() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        color: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        zIndex: 9999,
      }}
    >
      {/* Loading Spinner */}
      <div
        style={{
          width: "60px",
          height: "60px",
          border: "4px solid rgba(255, 255, 255, 0.1)",
          borderTop: "4px solid #7c3aed",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          marginBottom: "24px",
        }}
      />
      
      {/* Loading Text */}
      <div
        style={{
          fontSize: "18px",
          fontWeight: 500,
          marginBottom: "8px",
        }}
      >
        Loading Visual Editor
      </div>
      
      <div
        style={{
          fontSize: "14px",
          color: "rgba(255, 255, 255, 0.6)",
        }}
      >
        Preparing your theme editing experience...
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
