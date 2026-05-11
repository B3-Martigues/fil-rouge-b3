/**
 * Ce fichier gère l'état global de l'authentification avec Zustand.
 * Il permet de stocker l'utilisateur connecté, son rôle
 * et de persister ces informations dans le localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AuthState } from "./types";

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      /**Indique si un utilisateur est authentifié */
      isAuthenticated: false,

      /**Utilisateur actuellement connecté */
      currentUser: null,

      /**Rôle de l'utilisateur connecté */
      role: null,

      /**Authentifie un utilisateur et met à jour le store global */
      login: (user) => {
        set({
          isAuthenticated: true,
          currentUser: user,
          role: user.role,
        });
      },

      /**Déconnecte l'utilisateur et réinitialise l'état global */
      logout: () => {
        set({
          isAuthenticated: false,
          currentUser: null,
          role: null,
        });
      },
    }),
    /**Persistence du store dans le localStorage */
    { name: "auth-storage" },
  ),
);

export default useAuthStore;
