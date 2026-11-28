#!/bin/sh
# Fills dist/ with the public page: the docs page, the tool, the sample and the page's own styles, as they are in the last
# commit. Reading from the commit keeps untracked files in the working folder out of what is published.
set -eu
cd "$(dirname "$0")/.."
rm -rf dist
mkdir dist
git archive HEAD index.html crittable sample site | tar -x -C dist

# Cloudflare Web Analytics for the deployed page only (Phil, 2026-11-28). The token stays out of the repo, so a fork
# that builds this never reports to his account: set CF_BEACON_TOKEN in the deploying shell and the beacon is added to
# each page's </body>; without it the pages are published as committed.
if [ -n "${CF_BEACON_TOKEN:-}" ]; then
  case "$CF_BEACON_TOKEN" in *[!0-9a-f]*) echo "CF_BEACON_TOKEN must be hex" >&2; exit 1 ;; esac
  find dist -name '*.html' -exec perl -0pi -e 's#</body>#<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\x27{"token":"$ENV{CF_BEACON_TOKEN}"}\x27></script>\n</body>#' {} +
fi
