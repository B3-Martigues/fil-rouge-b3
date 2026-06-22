import { createContext, useContext, type ReactNode } from "react";

type StaffHeaderActionContextValue = {
  setAction?: (action: ReactNode | null) => void;
};

const StaffHeaderActionContext = createContext<StaffHeaderActionContextValue>({});

export const StaffHeaderActionProvider = StaffHeaderActionContext.Provider;

export const useStaffHeaderAction = () => useContext(StaffHeaderActionContext);
