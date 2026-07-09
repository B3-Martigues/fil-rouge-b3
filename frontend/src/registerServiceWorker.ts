export const registerServiceWorker = () => {
  // Le navigateur expose cette API uniquement si les service workers sont supportes.
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    // Demande au navigateur d'utiliser /sw.js comme service worker de l'application.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail in unsupported local or private browsing contexts.
    });
  });
};
