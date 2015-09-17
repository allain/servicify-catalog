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
  return servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 1}).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.equal(resolutions.length, 1);

    assertProps(t, resolutions[0], {id: 1, name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234});
  });
});

test('generates an id if none given', function (t) {
  return new Servicify().register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 1234}).then(function (registration) {
    t.equal(typeof registration.id, 'string');
  });
});

test('returns empty when no services resolve', function (t) {
  return new Servicify().resolve('a', '^1.0.0').then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('resolved to any service which satisfies dep', function (t) {
  var servicify = new Servicify();

  return Promise.all([
    servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1}),
    servicify.register({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2}),
    servicify.register({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3})
  ]).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.equal(resolutions.length, 2);
    assertProps(t, resolutions[0], {name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1});
    assertProps(t, resolutions[1], {name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3});
  });
});

test('supports deregistering by exact spec', function (t) {
  var servicify = new Servicify();

  return Promise.all([
    servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}),
    servicify.register({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2})
  ]).then(function () {
    return servicify.deregister({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12});
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistering by id', function (t) {
  var servicify = new Servicify();
  return Promise.all([
    servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1}),
    servicify.register({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2})
  ]).then(function () {
    return servicify.deregister(1);
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistration by resolution', function (t) {
  var servicify = new Servicify();
  return Promise.all([
    servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}),
    servicify.register({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2}),
    servicify.register({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3})
  ]).then(function () {
    return servicify.deregister('a', '^1.0.0');
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('supports deregistration by predicate', function (t) {
  var servicify = new Servicify();
  return Promise.all([
    servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}),
    servicify.register({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2}),
    servicify.register({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3})
  ]).then(function () {
    return servicify.deregister(function (spec) {
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
    servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}),
    servicify.register({name: 'b', version: '1.2.3', host: '127.0.0.1', port: 1234, id: 2}),
    servicify.register({name: 'a', version: '1.2.4', host: '127.0.0.1', port: 123, id: 3})
  ]).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    return servicify.deregister(resolutions);
  }).then(function () {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

test('resolutions have expirations when they are created', function (t) {
  var servicify = new Servicify();
  return servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12}).then(function(registration) {
    t.ok(registration.expires);
  });
});

test('touching registrations works', function (t) {
  var servicify = new Servicify();
  return servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 12, id: 1}).then(function (registration) {
    var expiresBefore = registration.expires;

    return Promise.delay(5).then(function () {
      return servicify.touch(1);
    }).then(function (touched) {
      t.notEqual(touched.expires, expiresBefore);
    });
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
  var servicify = new Servicify({lifetime: 10});

  return servicify.register({name: 'a', version: '1.2.3', host: '127.0.0.1', port: 2021}).then(function () {
    return Promise.delay(20);
  }).then(servicify.gc.bind(servicify)).then(function() {
    return servicify.resolve('a', '^1.0.0');
  }).then(function (resolutions) {
    t.deepEqual(resolutions, []);
  });
});

