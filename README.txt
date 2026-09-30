DT Music Trainer PWA

Upload these files together to the root of your GitHub Pages repository:
- index.html
- manifest.webmanifest
- service-worker.js
- icon-192.png
- icon-512.png

Google Drive OAuth:
The app keeps the same Google OAuth client ID used by your previous GitHub-hosted DT Music Scores build:
19844780595-pfas3r99o39m679oabln8p2uehm0deek.apps.googleusercontent.com

In Google Cloud Console > APIs & Services > Credentials > your Web OAuth Client,
add your GitHub Pages origin under Authorized JavaScript origins, for example:
https://derektyc.github.io

Do not add the repository path to Authorized JavaScript origins; Google only accepts origins.
If your Pages site uses a custom domain, add that HTTPS origin too.

Install:
Open the GitHub Pages HTTPS URL in Chrome/Edge/Android and use Install App when offered.
On iPhone/iPad Safari, use Share > Add to Home Screen.
