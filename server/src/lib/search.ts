import { tavily } from "@tavily/core";

const tavilyClient = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null;

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  if (!tavilyClient) {
    console.warn("Tavily API key not configured");
    return [];
  }

  try {
    const response = await tavilyClient.search(query, {
      searchDepth: "advanced",
      maxResults: 5,
      includeAnswer: true
    });

    return response.results.map((result: any) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score
    }));
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}
