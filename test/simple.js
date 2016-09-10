var assert     = require('assert');
var bodyParser = require('body-parser');
var express    = require('express');

var proxyObject = require('../index');
var busboy = require('connect-busboy');

describe('Simple Objects', function () {
  var server = null;

  beforeEach(function (done){
    server = null;
    done();
  });

  afterEach(function (done) {
    if (server) server.close();
    done();
  });

  var emptyHeaders = function () {
    return {};
  }

  it('One method object', function (done) {
    var app = express();
    app.use(busboy());

    var simpleObject = {
      'aMethod': function (cb) {
        setImmediate(function () { cb(null, 'Hello!') });
      }
    }

    app.post('/simple', proxyObject.createMiddleware(simpleObject));

    server = app.listen(3101, function () {
      var proxiedObject = proxyObject.createProxy('http://localhost:3101/simple', emptyHeaders, ['aMethod']);
      proxiedObject.aMethod(function (err, result) {
        assert.ok(!err);
        assert.equal(result, 'Hello!');
        done();
      })
    });
  });

  it('One method object with arguments', function (done) {
    var app = express();
    app.use(busboy());

    var simpleObject = {
      'aMethod': function (anArg, cb) {
        setImmediate(function () { cb(null, anArg) });
      }
    }

    app.post('/simple', proxyObject.createMiddleware(simpleObject));

    server = app.listen(3101, function () {
      var proxiedObject = proxyObject.createProxy('http://localhost:3101/simple', emptyHeaders, ['aMethod']);
      proxiedObject.aMethod('AHOY!', function (err, result) {
        assert.ok(!err);
        assert.equal(result, 'AHOY!');
        done();
      })
    });
  });

  it('Object with several methods', function (done) {
    var app = express();
    app.use(busboy());

    var simpleObject = {
      'm1': function (cb) {
        setImmediate(function () { cb(null, 'Hello ') });
      },
      'm2': function (cb) {
        setImmediate(function () { cb(null, 'World') });
      },
      'm3': function (cb) {
        setImmediate(function () { cb(null, '!') });
      }
    }

    app.post('/simple', proxyObject.createMiddleware(simpleObject));

    server = app.listen(3101, function () {
      var proxiedObject = proxyObject.createProxy('http://localhost:3101/simple', emptyHeaders, ['m1', 'm2', 'm3']);
      proxiedObject.m2(function (err, result) {
        assert.ok(!err);
        assert.equal(result, 'World');
        done();
      })
    });
  });
});
