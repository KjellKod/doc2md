# 042 — Mac License Verifier

The useful part of a license verifier is not the cryptography. The useful part is where it refuses to know too much.

This quest kept that boundary intact. The Mac app now understands the public token contract: nested purchaser, nested merchant, entitlement, lifecycle fields, key id, and signature. It does not know how to sell anything. It does not know where the issuer lives. It does not know a merchant credential, a webhook secret, a customer table, or a private signing key. Good. Curiosity is how production secrets end up in places they should not be.

The release key posture is deliberately inconvenient: `LicensePublicKeys.trustedKeys` is empty. A default build accepts no fixture token and trusts no placeholder. Future production work will have to add real public verification keys explicitly. That is a useful little lock on the door.

The review pass found the real defect: `JSONDecoder.dateDecodingStrategy = .secondsSince1970` accepts fractional numeric timestamps. The public contract says integer seconds, so the parser had to enforce integer seconds itself. `LicenseClaims` now decodes each date claim through `Int`, and the tests sign fractional-date payloads to prove they fail as malformed claims after signature verification gets its chance.

The rest was restraint:

- no checkout link;
- no disabled purchase scaffold;
- no network validation;
- no issuer URL in verifier code;
- no static private key fixture;
- no hosted-web licensing surface.

The verifier is not dramatic. It is a local parser, a public-key lookup, a signature check, and a few deterministic exits. That is the correct amount of machinery for this phase.

Next watch point: when production public keys arrive, keep them visibly public and keep the issuer private. The app can verify. It must never mint.
