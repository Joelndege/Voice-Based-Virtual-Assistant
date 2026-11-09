# Voice-Based Virtual Assistant

Three-page portfolio and browser-based prototype for the CP 81 Comprehension 2 project.

## Pages

- `index.html` — project overview
- `assistant.html` — interactive voice and typed command demo
- `project.html` — project documentation and repository link

## Run locally

Open the files in a modern browser. Typed commands work locally. Microphone recognition is browser dependent and usually requires HTTPS; GitHub Pages provides HTTPS. The demo supports time and date, random jokes, calculator expressions, weather lookups, web searches, selected website links, timers/reminders, notes, to-do items, and project FAQs. Responses use the browser's speech synthesis when available. Weather lookups use the Open-Meteo Geocoding and Forecast APIs.

Notes and to-do items are saved in browser local storage. Reminder timers run in the page and can use browser notifications if notification permission was already granted. A static webpage cannot launch native desktop applications; it can open supported websites in a new tab.

## Publish on GitHub Pages

1. Create a GitHub repository for this project and upload all files.
2. In repository **Settings → Pages**, select the `main` branch and `/ (root)` as the source.
3. Update the repository URL in `project.html` to your actual GitHub username and repository.
4. Add the lecturer as a collaborator using `stanslausphillimon@gmail.com`.
5. Submit both the repository URL and the published Pages URL.

The project uses no build step. Weather lookup requires an internet connection.
