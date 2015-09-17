var Promise = require('bluebird');

var semver = require('semver');
var ducktype = require('ducktype');
var uniqid = require('uniqid');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var defined = require('defined');


var specSchema = ducktype({
  name: String,
  version: String,
  host: String,
  port: Number
});

function Servicify(opts) {
  if (!(this instanceof Servicify)) return new Servicify(opts);
  this._opts = opts = opts || {};
  this._opts.lifetime = defined(opts.lifetime, 60000);
  this._registrations = [];

  EventEmitter.call(this);

  process.nextTick(function() {
    this.emit('ready');
  }.bind(this));
}

util.inherits(Servicify, EventEmitter);

Servicify.prototype.gc = function() {
  var now = Date.now();
  return this.deregister(function(r) {
    return r.expires < now;
  });
};

Servicify.prototype.register = function (spec) {
  if (!specSchema.test(spec))
    return Promise.reject(new Error('invalid service spec: ' + JSON.stringify(spec)));

  var existing = this._registrations.filter(matchBySpec(spec));
  if (existing.length) {
    return Promise.reject(new Error('cannot register a service twice'));
  }

  // clone spec so we don't clobber it
  var registered = JSON.parse(JSON.stringify(spec));
  registered.id = registered.id || uniqid();
  registered.expires = Date.now() + this._opts.lifetime;

  this._registrations.push(registered);

  this.emit('registered', registered);

  return Promise.resolve(registered);
};

Servicify.prototype.deregister = function () {
  var self = this;

  var matcher = buildMatcher(arguments[0], arguments[1]);

  var deregistered = [];

  this._registrations = this._registrations.filter(function(r) {
    if (matcher(r)) {
      deregistered.push(r);
      return false;
    }

    return true;
  });

  deregistered.forEach(function(d) {
    self.emit('deregistered', d);
  });

  return Promise.resolve(deregistered);
};

Servicify.prototype.touch = function() {
  var matcher = buildMatcher(arguments[0], arguments[1]);

  var newExpires = Date.now() + this._opts.lifetime;

  return Promise.resolve(this._registrations.filter(function(r) {
    if (matcher(r)) {
      r.expires = newExpires;
      return true;
    }
  }));
};

Servicify.prototype.resolve = function (name, required) {
  var resolutions =  this._registrations.filter(matchBySemver(name, required));

  if (resolutions.length) {
    this.emit('resolved', name, required, resolutions);
  } else {
    this.emit('unresolved', name, required);
  }

  return Promise.resolve(resolutions);
};

function buildMatcher() {
  var args = [].slice.call(arguments);

  if (args[0] && args[1]) {
    return matchBySemver(args[0], args[1]);
  }

  if (typeof args[0] === 'function') {
    return args[0];
  }

  if (Array.isArray(args[0])) {
    return matchByInclusion(args[0]);
  }

  if (typeof args[0] === 'object') {
   return matchBySpec(args[0]);
  }
  return matchById(args[0]);
}

function matchBySemver(name, required) {
  return function(r) {
    return r.name === name && semver.satisfies(r.version, required);
  };
}

function matchBySpec(spec) {
  return function (r) {
    return r.id === spec.id || (r.name === spec.name && r.version === spec.version && r.host === spec.host && r.port === spec.port);
  };
}

function matchByInclusion(array) {
  return function(r) {
    return array.indexOf(r) !== -1;
  };
}

function matchById(id) {
  return function (r) {
    return r.id === id;
  };
}

module.exports = Servicify;