import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const NavigationTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Navigation tracking placeholder – no-op without backend
  }, [location]);

  return null;
};

export default NavigationTracker;
