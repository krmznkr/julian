import { createContext } from "react";

// DOM inert does not reach body-level portals rendered by the main content.
export const AppContentInertContext = createContext(false);
