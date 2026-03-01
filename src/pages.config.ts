import Home from "./pages/Home";
import Layout from "./Layout";
import type { PagesConfig } from "./types";

export const PAGES: Record<string, React.ComponentType> = {
  Home: Home,
};

export const pagesConfig: PagesConfig = {
  mainPage: "Home",
  Pages: PAGES,
  Layout: Layout as React.ComponentType<{ currentPageName: string; children: React.ReactNode }>,
};
