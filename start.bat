set NODE_ENV=local
cd /d %~dp0
START npm run server
START npm run client
START gulp
