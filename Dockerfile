FROM node:18.16.0-alpine3.17

COPY application-code/ .

RUN npm install 

RUN chmod +x set-env.sh

EXPOSE 3000

CMD [ "npm", "start"]