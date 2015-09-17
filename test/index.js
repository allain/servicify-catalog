var test = require('blue-tape');
var Promise = require('bluebird');

var ServicifyCatalog = require('..');

function assertProps(t, obj, props) {
  Object.keys(props).forEach(function(prop) {
    t.equal(obj[prop], props[prop]);
  });
}

test('can be created without options', function (t) {
  var catalog = new ServicifyCatalog();
  t.ok(catalog instanceof ServicifyCatalog);
  t.end();
});

test('can register a service', function (t) {
  var catalog = new ServicifyCatalog();

  return catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 1, expires: 1}).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.equal(offerings.length, 1);

    assertProps(t, offerings[0], {id: 1, name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, expires: 1});
  });
});

test('generates an id if none given', function (t) {

  return new ServicifyCatalog().offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, expires: 1}).then(function (offering) {
    t.equal(typeof offering.id, 'string');
  });
});

test('returns empty when no services resolve', function (t) {
  return new ServicifyCatalog().resolve('a', '^1.0.0').then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('resolved to any service which satisfies dep', function (t) {
  var catalog = new ServicifyCatalog();
  var now = Date.now();
  return Promise.all([
    catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1, expires: 1}),
    catalog.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    catalog.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.equal(offerings.length, 2);
    assertProps(t, offerings[0], {name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1, expires: 1});
    assertProps(t, offerings[1], {name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3});
  });
});

test('supports rescinding by exact spec', function (t) {
  var catalog = new ServicifyCatalog();
  var now = Date.now();
  return Promise.all([
    catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    catalog.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 1})
  ]).then(function () {
    return catalog.rescind({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12});
  }).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('supports rescinding by id', function (t) {
  var catalog = new ServicifyCatalog();
  return Promise.all([
    catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1, expires: 1}),
    catalog.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2})
  ]).then(function () {
    return catalog.rescind(1);
  }).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('supports deregistration by resolution', function (t) {
  var catalog = new ServicifyCatalog();

  return Promise.all([
    catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    catalog.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    catalog.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return catalog.rescind('a', '^1.0.0');
  }).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistration by predicate', function (t) {
  var catalog = new ServicifyCatalog();

  return Promise.all([
    catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    catalog.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    catalog.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return catalog.rescind(function (spec) {
      return spec.name === 'a';
    });
  }).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistration by array', function (t) {
  var catalog = new ServicifyCatalog();
  return Promise.all([
    catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, expires: 1}),
    catalog.offer({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2, expires: 2}),
    catalog.offer({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3, expires: 3})
  ]).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    return catalog.rescind(offerings);
  }).then(function () {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (offerings) {
    t.deepEqual(offerings, []);
  });
});

test('resolutions require expirations ', function (t) {
  return new ServicifyCatalog().offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}).catch(function(err) {
    t.ok(err);
  });
});

test('emits expected events', function (t) {
  t.plan(1);

  new ServicifyCatalog().on('ready', function () {
    t.ok(true, 'ready emitted');
  });
});

test('gc deregisters services that have been dormant too long', function (t) {
  var catalog = new ServicifyCatalog();

  return catalog.offer({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 2021, expires: Date.now() + 5}).then(function () {
    return Promise.delay(20);
  }).then(function() {
    catalog.gc();
  }).then(function() {
    return catalog.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

