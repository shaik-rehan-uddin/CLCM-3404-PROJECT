#!/bin/bash
sudo apt-get update && \
sudo apt-get -y install ca-certificates curl gnupg && \
sudo install -m 0755 -d /etc/apt/keyrings && \
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
sudo chmod a+r /etc/apt/keyrings/docker.gpg && \
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null && \
sudo apt-get update && \
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && \
sudo systemctl enable docker.service && \
sudo systemctl enable containerd.service && \
sudo chown ubuntu /var/run/docker.sock;

sudo apt update && \
sudo apt install nginx -y && \
sudo systemctl start nginx && \
sudo systemctl enable nginx;

machine_ip=$(curl -s http://api.ipify.org)
echo "server {
    listen 80;
    server_name $machine_ip;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}" | sudo tee /etc/nginx/conf.d/deployment.conf && sudo systemctl restart nginx

