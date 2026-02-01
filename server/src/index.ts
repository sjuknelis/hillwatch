import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { NeonCacheService } from "./cache";
import { BillDatabaseService } from "./billDatabase";
import { TopicClassifierService } from "./topicClassifier";
import { CongressDistrictService, getCongressDistrictByLocation } from "./congressDistrict";
import { billTopicSearch } from "./topicSearch";
import type { CongressDistrict } from "./types";

const app = express();
const port = process.env.PORT || 3000;

let neonCache = new NeonCacheService();

let billDatabase = new BillDatabaseService(neonCache);
let topicClassifier = new TopicClassifierService(neonCache);
let congressDistricts = new CongressDistrictService(neonCache);

async function initializeAll() {
    await billDatabase.initialize();
    await topicClassifier.initialize(billDatabase.topics);
    await congressDistricts.initialize();
}

async function refresh() {
    await neonCache.purge();
    await initializeAll();
}

app.use(cors());

app.use(rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	ipv6Subnet: 56
}));

app.get("/search", async (req, res) => {
    const headline = req.query.headline;
    if (!headline) {
        res.status(400).send("Bad request");
        return;
    }

    let district = null;
    const districtString = req.query.district?.toString();
    if (districtString) {
        try {
            district = JSON.parse(districtString) as CongressDistrict;
        } catch {
            res.status(400).send("Bad request");
            return;
        }
    }

    const headlineTopics = await topicClassifier.classify(headline.toString());
    res.send(JSON.stringify(billTopicSearch(billDatabase.bills, headlineTopics, district)));
});

app.get("/district", async (req, res) => {
    const [latString, lonString] = [req.query.lat?.toString(), req.query.lon?.toString()];
    if (!latString || !lonString) {
        res.send(400).send("Bad request");
        return;
    }

    const [lat, lon] = [parseFloat(latString), parseFloat(lonString)];
    if (isNaN(lat) || isNaN(lon)) {
        res.send(400).send("Bad request");
        return;
    }

    res.send(JSON.stringify(await getCongressDistrictByLocation(lat, lon)));
});

app.get("/all_districts", (req, res) => {
    res.send(JSON.stringify(congressDistricts.districts));
});

(async () => {
    await initializeAll();
    // setInterval(() => refresh(), 24 * 60 * 60 * 1000);

    app.listen(port, () => {
        console.log(`Listening on port ${port}`);
    });
})();