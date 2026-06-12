import { useEffect, useRef, useState } from "react";

import logoDark from "../../../assets/logo/logo_dark.svg";
import logoLight from "../../../assets/logo/logo_light.svg";

type AppSplashProps = {
  isReady: boolean;
  onFinished: () => void;
};

export default function AppSplash({
  isReady,
  onFinished,
}: AppSplashProps) {
  const [hasMetMinimumDuration, setHasMetMinimumDuration] = useState(false);
  const [shouldForceExit, setShouldForceExit] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const hasStartedExit = useRef(false);

  useEffect(() => {
    const minimumTimer = window.setTimeout(() => {
      setHasMetMinimumDuration(true);
    }, 1800);
    const fallbackTimer = window.setTimeout(() => {
      setShouldForceExit(true);
    }, 4200);

    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (
      hasStartedExit.current ||
      !hasMetMinimumDuration ||
      (!isReady && !shouldForceExit)
    ) {
      return;
    }

    hasStartedExit.current = true;
    setIsExiting(true);
    const doneTimer = window.setTimeout(onFinished, 900);

    return () => {
      window.clearTimeout(doneTimer);
    };
  }, [
    hasMetMinimumDuration,
    isReady,
    onFinished,
    shouldForceExit,
  ]);

  return (
    <div
      aria-label="Chargement de Mappening"
      className={`app-splash${isExiting ? " app-splash--exit" : ""}`}
      role="status"
    >
      <img
        alt="Mappening"
        className="app-splash__logo app-splash__logo--light"
        src={logoLight}
      />
      <img
        alt="Mappening"
        className="app-splash__logo app-splash__logo--dark"
        src={logoDark}
      />
    </div>
  );
}
