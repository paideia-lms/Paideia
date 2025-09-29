import { createContext } from "react-router";

export interface PageMeta {
	title: string;
	description?: string;
	keywords?: string[];
	ogImage?: string;
	canonical?: string;
	noIndex?: boolean;
	structuredData?: Record<string, any>;
}

export interface PageContext {
	meta: PageMeta;
	breadcrumbs: Array<{
		label: string;
		href?: string;
	}>;
	layout?: "default" | "course" | "admin" | "auth";
	theme?: "light" | "dark" | "auto";
}

export const pageContext = createContext<PageContext>();

export const pageContextKey = "pageContext" as unknown as typeof pageContext;
