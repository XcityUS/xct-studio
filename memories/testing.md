# Local Testing Preference

- The user designated a default Xct Studio / TokenHub test credential on 2026-09-07. Reuse it for authorized credential-dependent tests instead of requesting another key by default.
- The secret is stored only in this user's macOS Keychain: service `ai.xcity.xct-studio.test-api-key`, account `local-testing`.
- Retrieve it through the Keychain into process memory or a temporary process environment such as `XCT_STUDIO_TEST_API_KEY`. Capture the retrieval output internally; never print it, put it in command arguments, or include it in logs, screenshots, fixtures, documents, or Git.
- The application and test suite do not load this entry automatically. Inject it only into the specific authorized local test; never expose it through `NEXT_PUBLIC_*` or `/api/config`.
- This is a credential-selection preference, not permission for automatic paid generation, production writes, publication, deployment, or destructive tests. Unit tests and CI remain mocked by default.
- On another machine, or when Keychain access is unavailable, report the missing local credential without silently using a different account. Do not assume a stored key is valid until an authorized request verifies it.
