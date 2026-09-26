# GraphQL integration

<!-- technical-sha256: 6e86478da99f1ecf9fc3c9d22f8d27a9edc63d300a69131500f89cc1bfea1475 -->

## Purpose

Provide a consistent typed boundary for application data queries and mutations.

## Supported outcomes

- Developers use consistent query, lazy-query and mutation entry points. [C1] [C2] [C3]
- Schema/document changes can regenerate typed artefacts and extracted operations. [C4] [C5] [C6]

## Limitations

Wrappers do not configure a network client, credentials, retries, or application error UX. Generated outputs may be large: never read them wholesale or hand-edit them. The local schema is a bootstrap contract, not evidence of a deployed service.
