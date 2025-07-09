export interface TweetData {
  tweet: {
    id_str: string;
    full_text: string;
    created_at: string; // Format: "Tue Jul 08 13:40:22 +0000 2025"
    favorite_count: string; // Note: comes as string, not number
    retweet_count: string; // Note: comes as string, not number
    retweeted: boolean;
    favorited: boolean;
    lang: string;
    possibly_sensitive: boolean;
    entities: {
      hashtags: any[];
      symbols: any[];
      user_mentions: any[];
      urls: any[];
    };
    edit_info?: {
      initial: {
        editTweetIds: string[];
        editableUntil: string;
        editsRemaining: string;
        isEditEligible: boolean;
      };
    };
  };
}

export interface ProcessedTweet {
  id: string;
  text: string;
  created_at: string; // Converted to ISO string
  favorite_count: number;
  retweet_count: number;
  has_urls: boolean;
  has_mentions: boolean;
  has_hashtags: boolean;
}

export interface TurbopufferRow {
  id: string;
  vector: number[];
  text: string;
  created_at: string; // ISO string for filtering
  favorite_count: number;
  retweet_count: number;
  has_urls: boolean;
  has_mentions: boolean;
  has_hashtags: boolean;
}

export interface SearchOptions {
  query: string;
  type: "semantic" | "keyword" | "hybrid";
  dateAfter?: string;
  dateBefore?: string;
  limit?: number;
  minFavorites?: number;
  minRetweets?: number;
}

export interface Config {
  turbopuffer: {
    apiKey: string;
    region: string;
    namespace: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
}
