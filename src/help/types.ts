export interface HelpDocument {
  slug: string;
  title: string;
  description: string;
  content: string;
  updated?: string;
  order?: number;
}

export interface SearchResult {
  document: HelpDocument;
  matches: string[];
  score: number;
}

export interface HelpManifest {
  documents: HelpDocument[];
  categories: {
    [key: string]: HelpDocument[];
  };
}
