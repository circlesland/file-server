#!/bin/bash

echo "Installing dependencies .."
npm i

echo "Building file-server .."
rm -r -f dist
npx --no-install tsc || exit
mkdir dist/auth-client
cp src/auth-client/* dist/auth-client
