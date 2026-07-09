import { useEffect, useState } from "react";

const getOnlineStatus = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(getOnlineStatus());
    };

    // Le navigateur emet ces evenements quand la connexion change.
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return isOnline;
};
