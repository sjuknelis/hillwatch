import { NeonCacheService } from "./cache";
import type { CongressDistrict } from "./types";

type CongressMember = {
    firstName: string;
    lastName: string;
    state: string;
    districtNumber: number | null;
};

const STATE_DISTRICT_COUNTS = {
    'AL': 7, 'AK': 1, 'AZ': 9, 'AR': 4, 'CA': 52, 'CO': 8, 'CT': 5, 'DE': 1,
    'FL': 28, 'GA': 14, 'HI': 2, 'ID': 2, 'IL': 17, 'IN': 9, 'IA': 4, 'KS': 4,
    'KY': 6, 'LA': 6, 'ME': 2, 'MD': 8, 'MA': 9, 'MI': 13, 'MN': 8, 'MS': 4,
    'MO': 8, 'MT': 2, 'NE': 3, 'NV': 4, 'NH': 2, 'NJ': 12, 'NM': 3, 'NY': 26,
    'NC': 14, 'ND': 1, 'OH': 15, 'OK': 5, 'OR': 6, 'PA': 17, 'RI': 2, 'SC': 7,
    'SD': 1, 'TN': 9, 'TX': 38, 'UT': 4, 'VT': 1, 'VA': 11, 'WA': 10, 'WV': 2,
    'WI': 8, 'WY': 1
};

const STATE_ABBREVIATIONS: { [state: string]: string } = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY'
};

export class CongressDistrictService {
    cache: NeonCacheService
    districts: { [districtId: string]: CongressDistrict } = {}

    constructor(cache: NeonCacheService) {
        this.cache = cache;
    }

    async initialize() {
        this.districts = await this.cache.readKeyOrElseWrite("districts", async () => await this.loadDistricts());
    }

    private async loadDistricts() {
        // Fetch all members (House and Senate)
        const [houseMembers, senators] = await this.fetchAllMembers();

        // Create all possible districts (including vacant ones)
        const districts: { [districtId: string]: CongressDistrict } = {};

        for (const [state, districtCount] of Object.entries(STATE_DISTRICT_COUNTS)) {
            for (let districtNumber = 1; districtNumber <= districtCount; districtNumber++) {
                districts[`${state}-${districtNumber}`] = {
                    state,
                    districtNumber,
                    legislators: []
                };
            }
        }

        // Add House members to their districts
        for (const member of houseMembers) {
            const key = `${member.state}-${member.districtNumber}`;

            if (districts[key]) {
                districts[key].legislators.push({
                    type: "representative",
                    firstName: member.firstName,
                    lastName: member.lastName
                });
            }
        }

        // Add senators to each district in their state
        const senatorsByState: { [state: string]: CongressMember[] } = {};
        for (const senator of senators) {
            if (!senatorsByState[senator.state]) {
                senatorsByState[senator.state] = [];
            }
            senatorsByState[senator.state].push(senator);
        }

        for (const key of Object.keys(districts)) {
            const stateSenators = senatorsByState[districts[key].state] || [];
            for (const senator of stateSenators) {
                districts[key].legislators.push({
                    type: "senator",
                    firstName: senator.firstName,
                    lastName: senator.lastName
                });
            }
        }

        console.log(`Database built with ${Object.keys(districts).length} districts`);

        return districts;
    }

    private async fetchAllMembers(): Promise<[CongressMember[], CongressMember[]]> {
        const members: CongressMember[] = [];
        let offset = 0;
        const limit = 250;
        let hasMore = true;

        while (hasMore) {
            const url = `https://api.congress.gov/v3/member?api_key=${process.env.CONGRESS_API_KEY}&format=json&currentMember=true&limit=${limit}&offset=${offset}`;
            
            try {
                const response = await fetch(url);
                const data = await response.json() as any;
                
                if (!data.members || data.members.length === 0) {
                    hasMore = false;
                    break;
                }

                // Process all members
                const processedMembers = data.members
                    .map((m: any) => ({
                        firstName: m.name.split(", ")[1].split(" ")[0],
                        lastName: m.name.split(", ")[0],
                        state: STATE_ABBREVIATIONS[m.state],
                        districtNumber: parseInt(m.district) || null
                    }));

                members.push(...processedMembers);

                // Check if there are more results
                if (data.members.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } catch (error) {
                console.error('Error fetching members:', error);
                hasMore = false;
            }
        }

        const houseMembers = members.filter(m => m.districtNumber !== null);
        const senators = members.filter(m => m.districtNumber === null);
        return [houseMembers, senators];
    }
}

export async function getCongressDistrictByLocation(lat: number, lon: number): Promise<CongressDistrict | null> {
    try {
        const response = await fetch(`https://api.geocod.io/v1.7/reverse?q=${lat},${lon}&fields=cd&api_key=${process.env.GEOCODIO_API_KEY}`);
        const data = await response.json() as any;

        if (data.results && data.results[0]?.fields?.congressional_districts) {
            const address = data.results[0].address_components;
            const cd = data.results[0].fields.congressional_districts[0];
            return {
                state: address.state,
                districtNumber: cd.district_number,
                legislators: cd.current_legislators.map((legislator: any) => ({
                    type: legislator.type,
                    firstName: legislator.bio.firstName,
                    lastName: legislator.bio.lastName
                }))
            };
        }

        return null;
    } catch (error) {
        console.log("Error fetching district:", error);
        return null;
    }
}