# Делим счёт (Split the bill)

A web app for people who travel in a group or go to a cafe together: enter the expenses, and the app calculates who owes whom and how much, and reduces the settlements to the minimal number of transfers. It is convenient to open on both a phone and a computer. The interface is in Russian.

<img src="docs/screenshot.png" width="390" alt="The app «Делим счёт» on a phone: an example bill with the participants Аня, Боря, Вера and Гоша and the expense form">

<img src="docs/screenshot-desktop.png" alt="The app «Делим счёт» on a computer: participants and expenses on the left, the summary with three transfers and the «Поделиться» button on the right">

## Features

- Participants: add and remove people from the group.
- Expenses: who paid, how much and for whom: for everyone or only for part of the group.
- Summary: the minimal number of transfers and an explanation of how it was calculated (who paid how much and what their share is).
- Light and dark themes follow the system setting; on a wide screen there are two columns: participants and expenses on the left, the summary on the right.
- The "Поделиться" (share) link needs no server or registration: the bill is stored in the address fragment after `#`, and the server never receives it.

## Running locally

Node 22 or newer is required.

```sh
npm ci            # install dependencies
npm run dev       # dev server at http://localhost:5173/ — open the address in a browser
make check        # checks: formatting, types, linter, tests, build
npm run build     # build into the dist directory
npm run preview   # look at the built app
npm run format    # format the code
```

## Project structure

- `src/bill` — the bill: participants, expenses, amounts in kopecks.
- `src/settlement` — the calculation: balances, shares and reducing debts to the minimal number of transfers.
- `src/sharing` — encoding the bill into a link and parsing the link.
- `src/ui` — the interface: page sections and DOM handling.
- `src/style.css` — styles: tokens (colors of both themes, spacing, radii) and the layout for phone and computer; the rules are in AGENTS.md, section "Interface style".
- `index.html` — the only page; it loads `src/main.ts`.
- `.github/workflows` — checks on pull requests and deployment to GitHub Pages.

Domain logic (`src/bill`, `src/settlement`, `src/sharing`) knows nothing about the DOM: ESLint enforces this.

## Deploying to GitHub Pages

The site is deployed from the `main` branch by the workflow "Выкладка на GitHub Pages" (Deploy to GitHub Pages). The workflow "Проверки" (Checks) runs `make check` on every pull request into `main`.

1. In the repository open Settings → Pages → Build and deployment and choose Source: "GitHub Actions".
2. Push to `main` or open Actions → "Выкладка на GitHub Pages" → Run workflow (branch `main`: the `github-pages` environment by default allows deployment only from the default branch).

The site address is `https://<owner>.github.io/split-bill/`. It appears in Settings → Pages and in the run summary of the "Выкладка" (Deployment) job.

## Limitations

- A very large bill (hundreds of participants or thousands of expenses) may not fit into a link and will open as corrupted.
- The exact minimum number of transfers is guaranteed for up to 16 participants with a non-zero balance; beyond that the calculation is approximate, and the app says so.
