import type { Bill, CongressDistrict, ScoredTopic } from "./types";

export function billTopicSearch(
    bills: Bill[],
    searchScoredTopics: ScoredTopic[],
    district: CongressDistrict | null
): Bill[] {
    const buckets = [];
    for (const _ of searchScoredTopics) {
        buckets.push([] as Bill[]);
    }

    const confidences = searchScoredTopics.map(({ confidence }) => confidence);
    const totalConfidence = confidences.reduce((a, b) => a + b);
    const bucketSizes = confidences.map(confidence => Math.ceil(confidence / totalConfidence * 5));

    let remainingToSelect = bucketSizes.reduce((a, b) => a + b);

    const orderedBills = district ? precedeLegislatorBills(bills, district) : bills;

    for (let i = 0; i < orderedBills.length && remainingToSelect > 0; i++) {
        const bill = orderedBills[i];

        const billTopics = [
            bill.subjects.policyArea?.name,
            ...bill.subjects.legislativeSubjects.map(item => item.name)
        ]
        .filter(item => item !== undefined);

        for (let j = 0; j < searchScoredTopics.length; j++) {
            const { topic } = searchScoredTopics[j];

            if (buckets[j].length >= bucketSizes[j]) {
                continue;
            }

            if (billTopics.includes(topic)) {
                buckets[j].push(bill);
                remainingToSelect--;
            }
        }
    }

    return buckets.reduce((a, b) => a.concat(b));
}

function precedeLegislatorBills(bills: Bill[], district: CongressDistrict): Bill[] {
    const legislatorBills = [], nonLegislatorBills = [];

    for (const bill of bills) {
        const isLegislatorBill = district.legislators.some((districtLegislator) => (
            bill.cosponsors.some((billLegislator) => (
                districtLegislator.firstName == billLegislator.firstName &&
                districtLegislator.lastName == billLegislator.lastName
            ))
        ));

        if (isLegislatorBill) {
            legislatorBills.push(bill);
        } else {
            nonLegislatorBills.push(bill);
        }
    }

    return legislatorBills.concat(nonLegislatorBills);
}