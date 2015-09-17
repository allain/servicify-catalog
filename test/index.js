var test = require('blue-tape');
var Promise = require('bluebird');

var Servicify = require('..');

function assertProps(t, obj, props) {
  Object.keys(props).forEach(function(prop) {
    t.equal(obj[prop], props[prop]);
  });
}

test('can be created without options', function (t) {
  var servicify = new Servicify();
  t.ok(servicify instanceof Servicify);
  t.end();
});

test('can register a service', function (t) {
  var servicify = new Servicify();

  return servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 1, expires: 1}).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.equal(offerings.length, 1);

    assertProps(t, offerings[0], {id: 1, name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, expires: 1});
  });
});

test('generates an id if none given', function (t) {

  return new Servicify().offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, expires: 1}).then(function (offering) {
    t.equal(typeof offering.id, 'string');
  });
});

test('returns empty when no services resolve', function (t) {
  return new Servicify().resolve('a', '^1.0.0').then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('resolved to any service which satisfies dep', function (t) {
  var servicify = new Servicify();
  var now = Date.now();
  return Promise.all([
    servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1, expires: 1}),
    servicify.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    servicify.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.equal(offerings.length, 2);
    assertProps(t, offerings[0], {name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1, expires: 1});
    assertProps(t, offerings[1], {name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3});
  });
});

test('supports rescinding by exact spec', function (t) {
  var servicify = new Servicify();
  var now = Date.now();
  return Promise.all([
    servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    servicify.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 1})
  ]).then(function () {
    return servicify.rescind({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12});
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('supports rescinding by id', function (t) {
  var servicify = new Servicify();
  return Promise.all([
    servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1, expires: 1}),
    servicify.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2})
  ]).then(function () {
    return servicify.rescind(1);
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('supports deregistration by resolution', function (t) {
  var servicify = new Servicify();

  return Promise.all([
    servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    servicify.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    servicify.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return servicify.rescind('a', '^1.0.0');
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistration by predicate', function (t) {
  var servicify = new Servicify();

  return Promise.all([
    servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    servicify.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    servicify.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return servicify.rescind(function (spec) {
      return spec.name === 'a';
    });
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistration by array', function (t) {
  var servicify = new Servicify();
  return Promise.all([
    servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    servicify.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    servicify.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    return servicify.rescind(offerings);
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('resolutions require expirations ', function (t) {
  var servicify = new Servicify();

  return servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}).catch(function(err) {
    t.ok(err);
  });
});

test('emits expected events', function (t) {
  t.plan(1);
  var servicify = new Servicify();
  servicify.on('ready', function () {
    t.ok(true, 'ready emitted');
  });
});

test('gc deregisters services that have been dormant too long', function (t) {
  var servicify = new Servicify();

  return servicify.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 2021, expires: Date.now() + 5}).then(function () {
    return Promise.delay(20);
  }).then(function() {
    servicify.gc();
  }).then(function() {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

