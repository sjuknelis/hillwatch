import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export class NeonCacheService {
    sql: NeonQueryFunction<false, false>;

    constructor() {
        this.sql = neon(process.env.NEON_URL || "");
    }

    async readKey(key: string) {
        const result = await this.sql`SELECT * FROM cache WHERE key = ${key}`;
        if (result.length > 0) {
            return result[0].value;
        }
        throw new Error("invalid cache key");
    }

    async writeKey(key: string, value: any) {
        await this.sql`UPDATE cache SET value = ${JSON.stringify(value)} WHERE key = ${key}`;
    }

    async readKeyOrElseWrite(key: string, callback: () => Promise<any>) {
        const cached = await this.readKey(key);
        if (cached) {
            return cached;
        }

        const result = await callback();
        await this.writeKey(key, result);
        return result;
    }

    async purge() {
        await this.sql`UPDATE cache SET value = NULL`;
    }
}