# Fold — PDF merger

A client-side PDF merger. Files are read and combined in your browser; they are not uploaded.

## Run

Open `index.html` in a modern browser. An internet connection is required to load the pinned PDF libraries from CDN. If your browser restricts local-file workers, serve this folder with any static web server and open its local URL.

## Files

- `index.html` — app markup and CDN library references
- `styles.css` — responsive styling, light/dark themes, and animations
- `app.js` — file handling, page counting, ordering, merging, and download cleanup

## Dependencies

- PDF.js 3.11.174 — page counts
- pdf-lib 1.17.1 — PDF merging
