chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install" || details.reason === "update") {
        const { privacyPolicyAccepted, privacyPolicyVersion } =
            await chrome.storage.local.get(["privacyPolicyAccepted", "privacyPolicyVersion"]);

        const currentVersion = "1.0";

        if (!privacyPolicyAccepted || privacyPolicyVersion !== currentVersion) {
            chrome.tabs.create({ url: "privacy-policy.html" });
        }
    }
});