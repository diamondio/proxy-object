var request = require('request');

var isInTest = typeof global.it === 'function';

var callMethod = function (url, getHeaders, method, args, cb, retry) {
  if (isInTest && retry === undefined ) retry = 10;
  request({
    url: url,
    dataType: 'json',
    method: "POST",
    timeout: 3000,
    headers: getHeaders(),
    json: {
      args,
      method
    }
  }, function (err, res) {
    if (err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') && retry) {
      return setTimeout(function () {
        retry--;
        callMethod(url, getHeaders, method, args, cb, retry);
      }, 3);
    }
    if (err && !res) return cb({ message: 'no_internet', details: err });
    if (!res) return cb({ message: 'no_response' });
    if (err) return cb(err);
    if (res.statusCode !== 200) return cb({ message: 'unexpected_status_code', details: `${res.statusCode} ${res.body}`});

    cb.apply(null, res.body);
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
    var args = req.body['args'];
    var method = req.body['method'];
    if (!args) return res.status(400).json({message: 'Missing args'});
    if (!method) return res.status(400).json({message: 'Missing method'});
    if (!obj[method]) return res.status(400).json({message: 'Proxy object does not have method: ' + method});
    args.push(function () {
      res.json(Array.prototype.slice.call(arguments));
    });
    obj[method].apply(obj, args);
  };
};

