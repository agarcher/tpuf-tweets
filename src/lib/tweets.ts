import { TweetData, ProcessedTweet } from "../types/index.js";

export class TweetProcessor {
  static processTweet(tweetData: TweetData): ProcessedTweet {
    const { tweet } = tweetData;

    // Convert Twitter date format to ISO string
    const createdAt = new Date(tweet.created_at).toISOString();

    // Convert string numbers to integers
    const favoriteCount = parseInt(tweet.favorite_count, 10) || 0;
    const retweetCount = parseInt(tweet.retweet_count, 10) || 0;

    // Extract boolean flags for content types
    const hasUrls = tweet.entities.urls.length > 0;
    const hasMentions = tweet.entities.user_mentions.length > 0;
    const hasHashtags = tweet.entities.hashtags.length > 0;

    return {
      id: tweet.id_str,
      text: tweet.full_text,
      created_at: createdAt,
      favorite_count: favoriteCount,
      retweet_count: retweetCount,
      has_urls: hasUrls,
      has_mentions: hasMentions,
      has_hashtags: hasHashtags,
    };
  }

  static async loadTweetsFromFile(filePath: string): Promise<TweetData[]> {
    // TODO: Implement JSON file loading
    console.log(`Loading tweets from: ${filePath}`);
    return [];
  }

  static validateTweetData(tweetData: any): tweetData is TweetData {
    // TODO: Implement validation logic
    return (
      tweetData &&
      tweetData.tweet &&
      typeof tweetData.tweet.id_str === "string" &&
      typeof tweetData.tweet.full_text === "string" &&
      typeof tweetData.tweet.created_at === "string"
    );
  }
}
