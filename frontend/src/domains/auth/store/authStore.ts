/**
 * Ce fichier gère l'état global de l'authentification avec Zustand.
 * Il permet de stocker l'utilisateur connecté, son rôle
 * et de persister ces informations dans le localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isAccountSuspended } from "../../user/types/user";
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
        if (!user.is_active || isAccountSuspended(user)) {
          set({
            isAuthenticated: false,
            currentUser: null,
            role: null,
          });
          return false;
        }

        set({
          isAuthenticated: true,
          currentUser: user,
          role: user.role,
        });
        return true;
      },

      /**Déconnecte l'utilisateur et réinitialise l'état global */
      logout: () => {
        set({
          isAuthenticated: false,
          currentUser: null,
          role: null,
        });
      },

      /**Met à jour les données utilisateur */
      updateUser: (updatedUser) => {
        set((state) => ({
          currentUser: state.currentUser
            ? {
                ...state.currentUser,
                ...updatedUser,
              }
            : null,
        }));
      },
    }),

    
    /**Persistence du store dans le localStorage */
    { name: "auth-storage-v4" },
  ),
);

export default useAuthStore;
