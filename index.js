'use strict';

const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const fs = require('fs');
require('dotenv').config();

const server = new Hapi.Server({connections: {routes: {files: {relativeTo: Path.join(__dirname, 'dump')}}}});

server.connection({port: process.env.PORT || 3000});
server.register(Inert, () => {
});

const dumpHandler = {directory: {path: '.', redirectToSlash: true, index: true}};

const getDumpFunctions = (db, dbName, collections) => {
  let dumpFunctions = [];
  for (let i = 0; i < collections.length; i++) {
    ((collectionName) => {
      dumpFunctions.push(new Promise((resolve, reject) => {
        db.collection(collectionName).find().toArray((err, data) => {
          if (err) {
            reject(err);
            return;
          }
          let r = {};
          r.collection = collectionName;
          r.data = data;
          resolve(r);
        });
      }));
    })(collections[i]);
  }
  return dumpFunctions;
};

const makeDumpHandler = (request, reply) => {
  if (!request.query.dbName) {
    reply({error: 'db name not defined'}).code(500);
    return;
  }
  const dbName = request.query.dbName;
  require('mongodb').MongoClient.connect('mongodb://' +
    (process.env.MONGO_HOST || 'localhost') +
    ':' +
    (process.env.MONGO_PORT || '27017') +
    '/' + dbName, function (err, db) {
    console.log('db connected');
    db.listCollections().toArray((err, collections) => {
      let collectionNames = collections.map((collection) => {
        return collection.name;
      }).filter((name) => {
        return !/^system\.*/.test(name);
      });
      console.log('exporting collections: ' + collectionNames.toString());
      Promise.all(getDumpFunctions(db, dbName, collectionNames)).then((r) => {
        fs.writeFileSync('./dump/' + dbName + '.json', JSON.stringify(r));
        reply({
          file: '/dump/' + dbName + '.json'
        });
      });
    });

  });

};

server.register(require('hapi-auth-header'), function (err) {
  server.auth.strategy('secret', 'auth-header', {
    validateFunc: function (tokens, callback) {
      if (tokens.Bearer === process.env.SECRET) {
        callback(null, true, {token: tokens.bearer})
      } else {
        callback(null, false, {token: tokens.bearer})
      }
    }
  });
  server.route({
    method: 'GET',
    path: '/make-dump',
    handler: makeDumpHandler,
    config: {auth: 'secret'}
  });
  server.route({
    method: 'GET',
    path: '/dump/{param*}',
    handler: dumpHandler,
    config: {auth: 'secret'}
  });
  server.start(function
    (err) {
    if (err) throw new Error(err);
    console.log('Server started at: ' + server.info.uri);
  })
});
