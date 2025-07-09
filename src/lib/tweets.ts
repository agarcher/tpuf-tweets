import { TweetData, ProcessedTweet } from "../types/index.js";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

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
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const fileContent = await readFile(filePath, "utf-8");
      const rawData = JSON.parse(fileContent);

      if (!Array.isArray(rawData)) {
        throw new Error("JSON file must contain an array of tweets");
      }

      const validTweets: TweetData[] = [];
      const invalidTweets: string[] = [];

      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        if (this.validateTweetData(item)) {
          validTweets.push(item);
        } else {
          invalidTweets.push(`Index ${i}: ${item?.tweet?.id_str || "unknown"}`);
        }
      }

      if (invalidTweets.length > 0) {
        console.warn(
          `⚠️  Skipped ${invalidTweets.length} invalid tweets: ${invalidTweets
            .slice(0, 5)
            .join(", ")}${invalidTweets.length > 5 ? "..." : ""}`
        );
      }

      if (validTweets.length === 0) {
        throw new Error("No valid tweets found in the file");
      }

      return validTweets;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON file: ${error.message}`);
      }
      throw error;
    }
  }

  static validateTweetData(tweetData: any): tweetData is TweetData {
    if (!tweetData || typeof tweetData !== "object") {
      return false;
    }

    const tweet = tweetData.tweet;
    if (!tweet || typeof tweet !== "object") {
      return false;
    }

    // Validate required fields
    if (typeof tweet.id_str !== "string" || tweet.id_str.length === 0) {
      return false;
    }

    if (typeof tweet.full_text !== "string" || tweet.full_text.length === 0) {
      return false;
    }

    if (typeof tweet.created_at !== "string" || tweet.created_at.length === 0) {
      return false;
    }

    // Validate that created_at is a valid date format
    const dateTest = new Date(tweet.created_at);
    if (isNaN(dateTest.getTime())) {
      return false;
    }

    // Validate string numbers (they should be convertible to numbers)
    if (
      typeof tweet.favorite_count !== "string" ||
      isNaN(parseInt(tweet.favorite_count, 10))
    ) {
      return false;
    }

    if (
      typeof tweet.retweet_count !== "string" ||
      isNaN(parseInt(tweet.retweet_count, 10))
    ) {
      return false;
    }

    // Validate boolean fields
    if (typeof tweet.retweeted !== "boolean") {
      return false;
    }

    if (typeof tweet.favorited !== "boolean") {
      return false;
    }

    // Validate entities structure
    if (!tweet.entities || typeof tweet.entities !== "object") {
      return false;
    }

    const entities = tweet.entities;
    if (
      !Array.isArray(entities.hashtags) ||
      !Array.isArray(entities.symbols) ||
      !Array.isArray(entities.user_mentions) ||
      !Array.isArray(entities.urls)
    ) {
      return false;
    }

    // Optional fields validation
    if (tweet.lang && typeof tweet.lang !== "string") {
      return false;
    }

    if (
      tweet.possibly_sensitive &&
      typeof tweet.possibly_sensitive !== "boolean"
    ) {
      return false;
    }

    return true;
  }

  static async processTweets(
    tweets: TweetData[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<ProcessedTweet[]> {
    const processedTweets: ProcessedTweet[] = [];

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      if (!tweet) continue;

      try {
        const processed = this.processTweet(tweet);
        processedTweets.push(processed);

        if (onProgress) {
          onProgress(i + 1, tweets.length);
        }
      } catch (error) {
        console.error(`Error processing tweet ${tweet.tweet.id_str}:`, error);
        // Continue processing other tweets
      }
    }

    return processedTweets;
  }
}
