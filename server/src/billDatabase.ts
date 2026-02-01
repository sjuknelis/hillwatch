import { NeonCacheService } from "./cache";
import type { Bill } from "./types";

export class BillDatabaseService {
    cache: NeonCacheService
    bills: Bill[] = [];
    topics: string[] = [];

    constructor(cache: NeonCacheService) {
        this.cache = cache;
    }

    async initialize() {
        this.bills = await this.cache.readKeyOrElseWrite("bills", async () => await this.loadBills());
        this.topics = await this.cache.readKeyOrElseWrite("topics", async () => await this.loadTopics());
    }

    private async loadBills() {
        console.log("Building bill database...");

        const bills = await this.fetchRecentBills();
        console.log(`Processing ${bills.length} bills...`);

        const detailedBills = [];

        for (let i = 0; i < bills.length; i++) {
            const bill = bills[i];

            try {
                detailedBills.push({
                    number: bill.number,
                    title: bill.title,
                    congress: bill.congress,
                    type: bill.type,
                    url: bill.url,
                    latestAction: bill.latestAction,
                    ...await this.getBillDetails(bill),
                } as Bill);

                if ((i + 1) % 10 === 0) {
                    console.log(`Processed ${i + 1}/${bills.length} bills...`);
                }
            } catch (error) {
                console.error(`Failed to process bill ${bill.number}:`, error);
            }
        }

        console.log(`Database built with ${detailedBills.length} bills`);

        return detailedBills;
    }

    private async loadTopics() {
        const topics = new Set();
        for (const bill of this.bills) {
            topics.add(bill.subjects.policyArea?.name);

            const subjects = bill.subjects.legislativeSubjects.map(item => item.name);
            for (const subject of subjects) {
                topics.add(subject);
            }
        }
        topics.delete(undefined);

        const topicsArr = Array.from(topics);
        topicsArr.sort();

        console.log(`Identified ${topicsArr.length} topics`);

        return topicsArr;
    }

    private async fetchRecentBills() {
        try {
            const allBills = [];
            const limit = 50;
            const totalToFetch = 50;

            const pages = Math.ceil(totalToFetch / limit);

            console.log(`Fetching ${totalToFetch} bills across ${pages} pages...`);

            for (let offset = 0; offset < totalToFetch; offset += limit) {
                const response = await fetch(
                    `https://api.congress.gov/v3/bill/119?api_key=${process.env.CONGRESS_API_KEY}&format=json&limit=${limit}&offset=${offset}&sort=updateDate+desc`
                );

                const data = await response.json() as any;

                if (!data.bills || data.bills.length === 0) {
                    console.log(`No more bills found at offset ${offset}`);
                    break;
                }

                allBills.push(...data.bills);
                console.log(`Fetched ${allBills.length} bills so far...`);
            }

            console.log(`Total bills fetched: ${allBills.length}`);
            return allBills;
        } catch (error) {
            console.error("Error fetching bills:", error);
            return [];
        }
    }

    private async getBillDetails(bill: any): Promise<any> {
        async function getDetail(detail: string) {
            const response = await fetch(
                `https://api.congress.gov/v3/bill/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}/${detail}?api_key=${process.env.CONGRESS_API_KEY}`
            );
            return (await response.json() as any)[detail];
        }

        try {
            const generalResponse = await fetch(
                `https://api.congress.gov/v3/bill/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}?api_key=${process.env.CONGRESS_API_KEY}`
            );
            const legislationUrl = (await generalResponse.json() as any).bill.legislationUrl;

            return {
                cosponsors: await getDetail("cosponsors"),
                subjects: await getDetail("subjects"),
                titles: await getDetail("titles"),
                legislationUrl,
            };
        } catch (error) {
            console.error("Error fetching bill details:", error);
            return null;
        }
    }
}