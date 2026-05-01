## Problem

Setting a PIN fails with `gen_salt(unknown, integer)`. The `pgcrypto` extension lives in the `extensions` schema (not `public`), so the `crypt()` and `gen_salt()` calls inside our PIN functions can't be resolved with the current `SET search_path = public`.

## Fix

Re-create the four PIN-related database functions with two changes:

1. Extend `search_path` to `public, extensions`.
2. Fully qualify the calls as `extensions.crypt(...)` and `extensions.gen_salt('bf'::text, 10)` (the explicit `::text` cast also avoids the `unknown` argument resolution issue).

Functions updated:
- `set_security_pin(text)`
- `verify_security_pin(text)`
- `reveal_student_identities(uuid, text, text)`
- `reveal_my_identities(text, text)`

No table or data changes. No client-side changes. Once approved, this is a single migration.
