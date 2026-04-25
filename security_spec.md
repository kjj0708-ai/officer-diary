# Security Specification - 10-Year Diary

## Data Invariants
1. A diary entry MUST be owned by the user specified in the `/users/{userId}` path.
2. The `userId` field in the document MUST match the `userId` in the path and the `request.auth.uid`.
3. `dateId` MUST be a valid string identifier.
4. `years` and `images` maps MUST NOT exceed size limits to prevent resource exhaustion.
5. Content strings within `years` MUST NOT exceed 10,000 characters.
6. Image URL lists within `images` MUST NOT exceed 10 elements.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: User A attempts to create an entry in User B's path.
2. **Field Injection**: Injecting an `isAdmin: true` field into the diary entry.
3. **Ghost Owner**: Creating an entry where the `userId` field is different from the path UID.
4. **Massive Content**: Attempting to save a 5MB string in a year slot.
5. **Path Traversal ID**: Using `../` as a `dateId` to escape the entries subcollection.
6. **Array Bomb**: Sending an `images` list with 10,000 URLs.
7. **Bypassing Server Timestamp**: Sending a client-side timestamp for `updatedAt`.
8. **Unauthorized Read**: User B attempts to read User A's diary entries.
9. **Orphaned Write**: Creating an entry without a `userId` field.
10. **Type Poisoning**: Sending a boolean instead of a string in the `years` map.
11. **Shadow Path**: Attempting to write to `/configs/admin_settings`.
12. **Malicious ID**: Using a 2KB string as a `dateId`.

## Test Runner Plan
The `firestore.rules.test.ts` will use `@firebase/rules-unit-testing` to verify these payloads are rejected.
