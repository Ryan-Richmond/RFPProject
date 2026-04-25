# SAM.gov API Terms Interpretation (Working Note)

Based on the provided terms excerpt:

- Automated access is **not allowed** for restricted or sensitive data using bots/data-mining tools.
- Software-based access to some SAM.gov data appears allowed **with permission** (via official connection methods/API keys/system accounts).
- Downloading some SAM.gov data is explicitly allowed.
- Access is limited to data your account is authorized to access.
- API credentials must be controlled (rotation, no sharing outside authorized organization users).
- Public redistribution is limited to data from public API versions.

## Practical implication for this app

Using the SAM.gov API is generally permissible **if**:

1. You use approved API/system-account access paths.
2. You only pull data your account is permitted to access.
3. You do not use login credentials for scraping/data-mining behavior.
4. You handle any sensitive data under SAM.gov terms.
5. You only publicly share data from public APIs.

> This is an operational interpretation, not legal advice.
