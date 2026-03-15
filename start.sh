#!/bin/bash
# Автозапуск diabetes-bot через PM2
export PM2_HOME=~/projects/.pm2
npx --cache /tmp/npm-cache pm2 resurrect 2>/dev/null || \
npx --cache /tmp/npm-cache pm2 start ~/projects/diabetes-bot/index.js --name diabetes-bot
