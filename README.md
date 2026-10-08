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

Node 22.12 or newer is required. The site is built with [Astro](https://astro.build/); the interface is a single [Solid](https://www.solidjs.com/) island.

```sh
npm ci            # install dependencies
npm run dev       # dev server at http://localhost:4321/split-bill/ — open the address in a browser
make check        # checks: formatting, types (astro check), linter, tests, build
npm run build     # build the static site into the dist directory
npm run preview   # look at the built app at http://localhost:4321/split-bill/
npm run format    # format the code
```

## Project structure

- `src/bill` — the bill: participants, expenses, amounts in kopecks.
- `src/settlement` — the calculation: balances, shares and reducing debts to the minimal number of transfers.
- `src/sharing` — encoding the bill into a link and parsing the link.
- `src/ui` — the interface: Solid components (`*.tsx`) for the page sections and their plain TypeScript helpers.
- `src/pages/index.astro` — the only page: a static shell with the `App` island (`<App client:load />`).
- `src/style.css` — styles: tokens (colors of both themes, spacing, radii) and the layout for phone and computer; the rules are in AGENTS.md, section "Interface style".
- `.github/workflows` — checks on pull requests and deployment to GitHub Pages.

Domain logic (`src/bill`, `src/settlement`, `src/sharing`) knows nothing about the DOM, Solid and Astro: ESLint enforces this.

## Deploying to GitHub Pages

The site is deployed from the `main` branch by the workflow "Deploy to GitHub Pages". The workflow "Checks" runs `make check` on every pull request into `main`.

1. In the repository open Settings → Pages → Build and deployment and choose Source: "GitHub Actions".
2. Push to `main` or open Actions → "Deploy to GitHub Pages" → Run workflow (branch `main`: the `github-pages` environment by default allows deployment only from the default branch).

`astro build` puts the site into `dist` with the base path `/split-bill/`, and the workflow publishes that directory. The site address is `https://<owner>.github.io/split-bill/`. It appears in Settings → Pages and in the run summary of the "Deploy" job.

## Limitations

- A very large bill (hundreds of participants or thousands of expenses) may not fit into a link and will open as corrupted.
- The exact minimum number of transfers is guaranteed for up to 16 participants with a non-zero balance; beyond that the calculation is approximate, and the app says so.
