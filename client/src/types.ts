export type Bill = {
    number: string
    title: string
    congress: number
    type: string
    url: string
    latestAction: {
        actionDate: string
        text: string
    }
    cosponsors: {
        firstName: string
        lastName: string
        party: string
    }[]
    subjects: {
        legislativeSubjects: {
            name: string
        }[]
        policyArea: {
            name: string
        }
    }
    legislationUrl: string
}

export type CongressDistrict = {
    state: string
    districtNumber: number
    legislators: {
        type: "representative" | "senator"
        firstName: string
        lastName: string
    }[]
}