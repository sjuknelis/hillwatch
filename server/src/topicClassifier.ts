import OpenAI from "openai";
import { NeonCacheService } from "./cache";
import type { ScoredTopic } from "./types";

export class TopicClassifierService {
    cache: NeonCacheService
    openai: OpenAI
    embeddings: { [topic: string]: number[] }

    constructor(cache: NeonCacheService) {
        this.cache = cache;
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.embeddings = {};
    }

    async initialize(topics: string[]) {
        this.embeddings = await this.cache.readKeyOrElseWrite("embeddings", async () => await this.loadEmbeddings(topics));
    }

    private async loadEmbeddings(topics: string[]) {
        console.log(`Creating topic embeddings for ${topics.length} topics...`);

        const embeddings: {[topic: string]: number[]} = {};

        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];

            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: topic
            });
            embeddings[topic] = response.data[0].embedding;

            if ((i + 1) % 10 === 0) {
                console.log(`Processed ${i + 1}/${topics.length} topics...`);
            }
        }

        console.log(`Embeddings generated for ${topics.length} topics`);

        return embeddings;
    }

    async classify(value: string) {
        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: value
        });
        const valueEmbedding = response.data[0].embedding;

        const similarities: {[topic: string]: number} = {};
        for (const [topic, topicEmbedding] of Object.entries(this.embeddings)) {
            similarities[topic] = this.cosineSimilarity(valueEmbedding, topicEmbedding);
        }

        const sortedScoredTopics = Object.entries(similarities)
            .map(([topic, similarity]) => ({ topic, confidence: similarity } as ScoredTopic))
            .sort((a, b) => b.confidence - a.confidence);
        const topConfidence = sortedScoredTopics[0].confidence;

        return sortedScoredTopics
            .slice(0, 5)
            .filter(scoredTopic => scoredTopic.confidence >= topConfidence / 2);
    }

    private cosineSimilarity(vecA: number[], vecB: number[]) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
}