import { createContext } from "react";
import type { MyAccess, User } from "../api";

export type AuthContextType = {
  user: User | null;
  access: MyAccess | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
