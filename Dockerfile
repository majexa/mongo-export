FROM node:7.2.0

RUN mkdir -p /usr/src/helpme-db-export
WORKDIR /usr/src/helpme-db-export

COPY ./package.json /usr/src/helpme-db-export
RUN npm install
COPY ./ /usr/src/helpme-db-export

CMD [ "node", "index.js" ]