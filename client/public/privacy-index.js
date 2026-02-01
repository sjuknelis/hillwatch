chrome.storage.local.get(["privacyPolicyAccepted", "privacyPolicyVersion"], (result) => {
    const currentVersion = "1.0";

    if (!result.privacyPolicyAccepted || result.privacyPolicyVersion !== currentVersion) {
        chrome.tabs.create({ url: "privacy-policy.html" });
        window.close();
    }
});