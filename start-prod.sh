#!/bin/bash
# Start the Node.js API using PM2

set -e

# Kill old PM2 process
pm2 delete emedic-api || true

# Start the API
pm2 start npm --name emedic-api -- run dev

# Save PM2 process list and enable startup on reboot
sudo env PATH=$PATH:/home/ec2-user/.nvm/versions/node/v20.18.3/bin \
/home/ec2-user/.nvm/versions/node/v20.18.3/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user

pm2 save
