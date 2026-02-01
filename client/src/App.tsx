import { useState, useEffect } from "react";
import DistrictFinder from "./DistrictFinder";
import type { Bill, CongressDistrict } from "./types";
import { baseUrl } from "./baseurl";

export default function App() {
    const [pageTitle, setPageTitle] = useState("");
    const [bills, setBills] = useState<Bill[]>([]);
    const [loading, setLoading] = useState(true);
    const [district, setDistrict] = useState<CongressDistrict | null>(null);

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].title !== undefined) {
                setPageTitle(tabs[0].title);
            }
        });
    }, []);

    useEffect(() => {
        (async () => {
            if (pageTitle.trim() === "") {
                return;
            }

            setLoading(true);
            try {
                let fetchUrl = `${baseUrl}/search?headline=${encodeURIComponent(pageTitle)}`;
                if (district) {
                    fetchUrl += `&district=${encodeURIComponent(JSON.stringify(district))}`;
                }

                const response = await fetch(fetchUrl);
                const data = (await response.json()) as Bill[];
                setBills(data);
            } catch (error) {
                console.error("Error fetching bills:", error);
                setBills([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [pageTitle, district]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const getBillTypeColor = (type: string) => {
        return type === "HR"
            ? "bg-blue-100 text-blue-800"
            : "bg-purple-100 text-purple-800";
    };

     const getSponsorshipInfo = (bill: Bill) => {
        if (!bill.cosponsors || bill.cosponsors.length === 0) {
            return null;
        }

        const partyCount = bill.cosponsors.reduce((acc, sponsor) => {
            const party = sponsor.party === "D" ? "D" : sponsor.party === "R" ? "R" : "I";
            acc[party] = (acc[party] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const userSponsors = district
            ? bill.cosponsors.filter((sponsor) => {
                return district.legislators.some(leg => 
                    leg.firstName === sponsor.firstName && 
                    leg.lastName === sponsor.lastName
                );
            })
            : [];

        return { partyCount, userSponsors, total: bill.cosponsors.length };
    };

    return (
        <div className="w-[600px] h-[500px] bg-white flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
                <h1 className="text-xl font-bold mb-1">Related Bills</h1>
                <p className="text-sm text-blue-100 truncate">{pageTitle}</p>
            </div>

            {/* District Info */}
            <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
                <DistrictFinder district={district} setDistrict={setDistrict} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <p>Finding related bills...</p>
                    </div>
                ) : bills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg
                            className="w-16 h-16 mb-3 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                        <p className="font-medium text-gray-700">No related bills found</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Try visiting a news article about legislation
                        </p>
                    </div>
                ) : (
                    bills.map((bill, index) => {
                        const sponsorshipInfo = getSponsorshipInfo(bill);
                        return (
                            <div
                                key={index}
                                className="mb-3 p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer bg-white"
                                onClick={() => window.open(bill.legislationUrl, "_blank")}
                            >
                                {/* Bill Number and Type */}
                                <div className="flex items-center gap-2 mb-2">
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-bold ${getBillTypeColor(bill.type)}`}
                                    >
                                        {bill.type} {bill.number}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {bill.congress}th Congress
                                    </span>
                                </div>

                                {/* Sponsorship Info */}
                                {sponsorshipInfo && (
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <div className="flex items-center gap-1 text-xs">
                                            <span className="font-semibold text-gray-600">Sponsors:</span>
                                            {sponsorshipInfo.partyCount.D && (
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                                                    {sponsorshipInfo.partyCount.D}D
                                                </span>
                                            )}
                                            {sponsorshipInfo.partyCount.R && (
                                                <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-medium">
                                                    {sponsorshipInfo.partyCount.R}R
                                                </span>
                                            )}
                                            {sponsorshipInfo.partyCount.I && (
                                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
                                                    {sponsorshipInfo.partyCount.I}I
                                                </span>
                                            )}
                                        </div>
                                        {sponsorshipInfo.userSponsors.map((sponsor, idx) => {
                                            const legislator = district?.legislators.find(leg => 
                                                leg.firstName === sponsor.firstName && 
                                                leg.lastName === sponsor.lastName
                                            );
                                            const prefix = legislator?.type === "senator" ? "Sen." : "Rep.";
                                            return (
                                                <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                                                    {prefix} {sponsor.firstName} {sponsor.lastName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Title */}
                                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                                    {bill.title}
                                </h3>

                                {/* Latest Action */}
                                <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                                    <p className="text-gray-700 line-clamp-2">
                                        {bill.latestAction.text}
                                    </p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        {formatDate(bill.latestAction.actionDate)}
                                    </p>
                                </div>

                                {/* Subjects */}
                                {bill.subjects.policyArea && (
                                    <div className="flex flex-wrap gap-1">
                                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                            {bill.subjects.policyArea.name}
                                        </span>
                                        {bill.subjects.legislativeSubjects
                                            .slice(0, 2)
                                            .map((subject, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                                                >
                                                    {subject.name}
                                                </span>
                                            ))}
                                        {bill.subjects.legislativeSubjects.length > 2 && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                +{bill.subjects.legislativeSubjects.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            {bills.length > 0 && (
                <div className="flex-shrink-0 bg-gray-50 px-4 py-2 text-center text-sm text-gray-600 border-t border-gray-200">
                    Found {bills.length} related {bills.length === 1 ? "bill" : "bills"}
                </div>
            )}
        </div>
    );
}