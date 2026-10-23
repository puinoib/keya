export interface HelpDocument {
  slug: string;
  title: string;
  description: string;
  content: string;
  /** Sidebar group, e.g. "Getting started". */
  category?: string;
  order?: number;
}

export interface SearchResult {
  document: HelpDocument;
  matches: string[];
  score: number;
}

export interface HelpManifest {
  documents: HelpDocument[];
  /** `all` plus one entry per category, both in display order. */
  categories: {
    [key: string]: HelpDocument[];
  };
}
