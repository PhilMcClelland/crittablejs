#!/bin/sh
# Fills dist/ with the public page: the docs page, the tool, the sample and the page's own styles, as they are in the last
# commit. Reading from the commit keeps untracked files in the working folder out of what is published.
set -eu
cd "$(dirname "$0")/.."
rm -rf dist
mkdir dist
git archive HEAD index.html crittable sample site | tar -x -C dist
