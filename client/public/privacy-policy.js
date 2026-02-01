document.getElementById("acceptButton").addEventListener("click", async () => {
    await chrome.storage.local.set({
        privacyPolicyAccepted: true,
        privacyPolicyVersion: "1.0" // Increment this when you update the policy
    });
    window.close();
});

document.getElementById('declineButton').addEventListener('click', async () => {
    window.close();
});