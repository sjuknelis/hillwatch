import { useEffect, useState } from "react";
import type { CongressDistrict } from "./types";
import { baseUrl } from "./baseurl";

const STATE_FULL_NAMES: { [state: string]: string } = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
    "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan",
    "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota",
    "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia",
    "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
}

export default function DistrictFinder({ district, setDistrict }: { district: CongressDistrict | null; setDistrict: (d: CongressDistrict | null) => void }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [allDistricts, setAllDistricts] = useState<{ [districtCode: string]: CongressDistrict }>({});
    const [showMenu, setShowMenu] = useState(false);
    const [selectedState, setSelectedState] = useState("");
    const [selectedDistrictNumber, setSelectedDistrictNumber] = useState(0);

    useEffect(() => {
        (async () => {
            const response = await fetch(`${baseUrl}/all_districts`);
            setAllDistricts(await response.json());
        })();
    }, []);
    
    const stateDistrictCounts = Object.values(allDistricts).reduce(
        (acc, { state, districtNumber }) => {
            acc[state] = Math.max(acc[state] || 0, districtNumber);
            return acc;
        },
        {} as { [state: string]: number }
    );

    const repNames = Object.fromEntries(
        Object.entries(allDistricts).map((([key, district]) => {
            const rep = district?.legislators.find((leg) => leg.type === "representative");
            if (rep) {
                return [key, `${rep.firstName} ${rep.lastName}`];
            } else {
                return [key, "N/A"];
            }
        }))
    );

    const fetchLocation = (): Promise<{ lat: number; lon: number } | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    resolve(null);
                }
            );
        });
    };

    const fetchDistrict = async (checkStored: boolean) => {
        setLoading(true);
        setError("");

        if (checkStored) {
            const storedData = (await chrome.storage.local.get(["congressDistrict"]))?.congressDistrict;
            if (storedData) {
                setDistrict(storedData as CongressDistrict);
                setLoading(false);
                return;
            }
        }

        const coords = await fetchLocation();
        if (!coords) {
            setLoading(false);
            setError("Unable to retrieve your location");
            return;
        }

        try {
            const response = await fetch(
                `${baseUrl}/district?lat=${coords.lat}&lon=${coords.lon}`
            );
            const data = (await response.json()) as CongressDistrict | null;

            if (!data) {
                setError("Unable to retrieve your congressional district");
                return;
            }

            chrome.storage.local.set({ congressDistrict: data });
            setDistrict(data);
        } catch (err) {
            console.error("Error fetching district:", err);
            setError("Failed to fetch district information");
        } finally {
            setLoading(false);
        }
    };

    const handleManualSelection = async () => {
        if (!selectedState || !selectedDistrictNumber) return;

        const data = allDistricts[`${selectedState}-${selectedDistrictNumber}`];

        chrome.storage.local.set({ congressDistrict: data });
        setDistrict(data);
        setShowMenu(false);
    };

    useEffect(() => {
        fetchDistrict(true);
    }, []);

    return (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            {loading ? (
                <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600">Loading district...</span>
                </div>
            ) : district ? (
                <div>
                    <div className="text-lg font-bold text-gray-900">
                        {STATE_FULL_NAMES[district.state]} - District {district.districtNumber}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <span className="text-sm font-semibold text-gray-500">
                            Your District
                        </span>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={() => fetchDistrict(false)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Update
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Change
                        </button>
                    </div>
                </div>
            ) : null}

            {showMenu && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        Select Your District
                    </div>
                    <div className="flex gap-2 mb-2">
                        <select
                            value={selectedState}
                            onChange={(e) => {
                                setSelectedState(e.target.value);
                                setSelectedDistrictNumber(1);
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">State</option>
                            {Object.keys(stateDistrictCounts).map(state => (
                                <option key={state} value={state}>{STATE_FULL_NAMES[state]}</option>
                            ))}
                        </select>
                        <select
                            value={selectedDistrictNumber}
                            onChange={(e) => setSelectedDistrictNumber(parseInt(e.target.value))}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="0">District</option>
                            {selectedState && Array.from({ length: stateDistrictCounts[selectedState] }, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>{num} - {repNames[`${selectedState}-${num}`]}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleManualSelection}
                        disabled={!selectedState || !selectedDistrictNumber}
                        className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                </div>
            )}
        </div>
    );
}