#!/bin/bash

# Retrieve the public IP address
PUBLIC_IP=34.203.100.249

# Set the APP_DOMAIN variable in the .env file
echo "APP_DOMAIN=http://${PUBLIC_IP}" > .env

# Run your application
nodemon app.js
