'use strict';

require('dotenv').config();

const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const fs = require('fs');
const fse = require('fs-extra');
const dbio = require('mongodb-io-native');
const server = new Hapi.Server({connections: {routes: {files: {relativeTo: Path.join(__dirname, 'dump')}}}});


const config = {
  out: 'dump'
};
if (process.env.MONGO_HOST) config.host = process.env.MONGO_HOST;
if (process.env.MONGO_PORT) config.port = process.env.MONGO_PORT;

const exec = require('child_process').exec;

const getDbs = (onComplete, onError) => {
  const host = config.host ? `--host ${config.host}` : '';
  const port = config.port ? `--port ${config.port}` : '';
  exec(`mongo ${host}${port} --eval "printjson(db.adminCommand('listDatabases'))"`, (err, out) => {
    if (err) {
      onError(err.toString());
      return;
    }
    console.log(out);
    let r = out.replace(/[\s\S]*connecting to:[\s\S]+\n({[\s\S]+)/m, '$1');
    r = JSON.parse(r);
    r = r.databases.filter((v) => {
      return v.empty === false;
    });
    r = r.map((v) => {
      return v.name;
    });
    onComplete(r);
  });
};

const dbExport = (dbName, onError, onComplete) => {
  getDbs(
    (dbs) => {
      if (dbs.indexOf(dbName) < 0) {
        onError(`Database ${dbName} does not exists or empty`);
        return;
      }
      dbio.export({
        config,
        dbs: [dbName]
      }).then((file) => {
        fse.copySync(file, `dump/${dbName}.tgz`);
        onComplete(`/dump/${dbName}.tgz`);
      });
    },
    onError
  );
};

server.connection({port: process.env.PORT || 3000});
server.register(Inert, () => {
});

const dumpHandler = {directory: {path: '.', redirectToSlash: true, index: true}};

const makeDumpHandler = (request, reply) => {
  if (!request.query.dbName) {
    reply({error: 'db name not defined'}).code(500);
    return;
  }
  dbExport(
    request.query.dbName,
    (error) => {
      console.log(error);
      reply({error});
    }, (file) => {
      reply({file});
    }
  );
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
