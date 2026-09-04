
- [x] Move "Class groups" (Assignment groups page) into the Classes page as an optional view; remove its own nav entry
- [x] Move "Standards" page into Library as an optional view; remove its nav entry
- [x] Completely remove the Tag Review page (route, nav, links)
- [x] DoK tagging: AI tagger returns DOK with standards; library items get DOK levels; generator has DOK / mix option; retroactive "Tag everything with DOK" card in Library
- [x] DoK analytics tab (coverage, trends, standard × DoK gaps)
- [x] Library export: Word / PDF / Excel (index, question bank, standards × DOK coverage) / Send to Canvas (page, assignment, quiz) — single + bulk; shared ExportResource layer ready for Google Classroom

## Google Classroom integration (approved 2026-09-04)
- [ ] Migration: google_credentials, resource_links (+ Canvas backfill), get_google_connection_status
- [ ] Edge: googleAuth shared, oauth start/callback/disconnect, list-courses, import, push
- [ ] Canvas push/import write resource_links
- [ ] UI: Settings Google card, Export → Google Classroom dialog, Library import tab, badges + filters
- [ ] Secrets: GOOGLE_OAUTH_CLIENT_ID/SECRET, GOOGLE_TOKEN_ENC_KEY
