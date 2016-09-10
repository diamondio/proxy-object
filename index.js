var request = require('request');
var zlib = require('zlib');
var streamToString = require('stream-to-string');
var stringToStream = require('string-to-stream');

var isInTest = typeof global.it === 'function';

var callMethod = function (url, getHeaders, method, args, cb, retry) {
  if (isInTest && retry === undefined ) retry = 10;
  var calledCB = false;
  var cbOnce = function (err, results) {
    if (!calledCB) {
      calledCB = true;
      if (err) return cb(err);
    }
    cb.apply(null, results);
  }

  var req = request({
    url: url,
    method: "POST",
    timeout: 8000,
    headers: getHeaders(),
    formData: {
        my_file:  zlib.gzipSync(JSON.stringify({args, method})),
      }

  }, function (err, res) {
    if (err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') && retry) {
      return setTimeout(function () {
        retry--;
        callMethod(url, getHeaders, method, args, cbOnce, retry);
      }, 3);
    }
    if (err && !res) return cbOnce({ message: 'no_internet', details: err });
    if (!res) return cbOnce({ message: 'no_response' });
    if (err) return cbOnce(err);
    if (res.statusCode !== 200) return cbOnce({ message: 'unexpected_status_code', details: `${res.statusCode} ${res.body}`});
  });
  streamToString(req.pipe(zlib.createGunzip()), function (err, string) {
    cbOnce(null, JSON.parse(string));
  });
}

exports.createProxy = function (url, getHeaders, methodList) {
  var proxyObject = {};
  methodList.forEach(function (methodName) {
    proxyObject[methodName] = function () {
      var callback = () => {};
      if (arguments.length) {
        callback = arguments[arguments.length - 1];
      }
      callMethod(url, getHeaders, methodName, Array.prototype.slice.call(arguments).slice(0, arguments.length - 1), callback);
    }
  })
  return proxyObject;
}

exports.createMiddleware = function (obj) { 
  return function (req, res, next) {
    req.busboy.on('file', function (fieldname, file, filename) {
      streamToString(file.pipe(zlib.createGunzip()), function (err, string) {
        if (err) console.log(err);
        var body = JSON.parse(string);
        var args = body['args']
        var method = body['method'];
        if (!args) return res.status(400).json({message: 'Missing args'});
        if (!method) return res.status(400).json({message: 'Missing method'});
        if (!obj[method]) return res.status(400).json({message: 'Proxy object does not have method: ' + method});
        args.push(function () {
          res.setHeader('Content-type', 'application/octet-stream');
          res.end(zlib.gzipSync(JSON.stringify(Array.prototype.slice.call(arguments))));
        });
        obj[method].apply(obj, args);
      });
    });
    req.pipe(req.busboy);
  };
};

