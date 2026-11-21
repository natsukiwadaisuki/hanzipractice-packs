# HanziPractice — Course Packs API

GitHub-backed, read-only course pack distribution for the HanziPractice Android app.

Every `.zip` in [`zips/`](./zips) is offered to the app under **Course Pack → From us**.
Each pack **must contain a `README.md`**: the app shows it full-screen, with images,
before the user confirms the import.

```text
hanzipractice.vercel.app/api
├── /api                     endpoint index
├── /api/health              GitHub reachability
├── /api/packs               list packs
├── /api/packs/{id}/readme   README.md extracted from the zip (JSON)
├── /api/packs/{id}/assets/{path}   images referenced by that README
└── /api/packs/{id}/download       the zip itself
```

## Adding a pack

1. Build a valid course package. The `hanzi-course-zip` skill in the app repo generates
   and validates one (`validate_course_zip.py course.zip` must print `PASS`).
2. Put `README.md` at the **root of the zip** (not inside a unit). It is the preview the
   student reads before importing. Relative images such as `![cover](cover.png)` work:
   they are served through `/api/packs/{id}/assets/...`.
3. Drop the zip into `zips/`.
4. Optionally describe it in `zips/index.json`:

```json
{
  "starter-course.zip": {
    "title": "Selamlaşma ve Aile — Başlangıç Paketi",
    "description": "İlk adım: 21 kelime, 3 konu.",
    "level": "A1",
    "language": "tr",
    "tags": ["başlangıç"]
  }
}
```

5. Commit and push to `main`. Vercel redeploys automatically; the app refreshes its list.

Without an `index.json` entry, the title is derived from the filename and the
description stays empty.

## What the app does with it

- Lists packs under **From us — Made with love by HanziPractice team <3**.
- Fetches `/readme`, renders it full-screen with Google Sans typography and images.
- On **Import**, downloads `/download` and runs the normal, sandboxed ZIP importer.

## Configuration

Environment variables (all optional; defaults target this repo):

| Variable | Default | Meaning |
|---|---|---|
| `GH_OWNER` | `natsukiwadaisuki` | GitHub user or org |
| `GH_REPO` | `hanzipractice-packs` | Repository name |
| `GH_BRANCH` | `main` | Branch to read |
| `GH_ZIPS_PATH` | `zips` | Folder holding the packs |
| `GITHUB_TOKEN` | – | Only needed for a private repo, or to raise rate limits |

No API keys are required for a public repo. The API is read-only and never accepts
uploads.

## Local development

```bash
npm install
npx vercel dev        # http://localhost:3000/api/packs
```

## Notes

- Zip bytes are cached in memory for 10 minutes per function instance.
- `readme` and `assets` responses are cached at the edge (`s-maxage`), so a pack page
  does not re-download the zip for every image.
- Path traversal in asset paths is rejected.
