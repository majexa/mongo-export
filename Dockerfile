FROM ubuntu:16.04

# mongo
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
RUN echo "deb [ arch=amd64,arm64 ] http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.4 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-3.4.list
RUN apt-get update
RUN apt-get install -y mongodb-org

# node
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

RUN apt-get install -y mc

# project
RUN mkdir -p /usr/src/mongo-export
RUN mkdir /usr/src/mongo-export/dump
WORKDIR /usr/src/mongo-export

COPY ./package.json /usr/src/mongo-export
RUN npm install
COPY ./ /usr/src/mongo-export

CMD [ "node", "index.js" ]