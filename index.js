'use strict'

var debug = require('debug')('rethinkdb:pool')
var Pool = require('generic-pool').Pool

function toArray (cursorOrResult) {
  if (cursorOrResult && typeof cursorOrResult.toArray === 'function') {
    return cursorOrResult.toArray()
  } else {
    return cursorOrResult
  }
}

module.exports = function (r, options) {
  function create (done) {
    console.log("rethinkdb-pool: create");
    return r.connect(options, done)
  }

  function destroy (connection) {
    console.log("rethinkdb-pool: destroy");
    connection.close()
  }

  function validate (connection) {
    return connection.isOpen()
  }

  var pool = new Pool({
    name: 'rethinkdb',
    create: create,
    destroy: destroy,
    validate: validate,
    log: options.log || debug,
    max: options.max || 10,
    min: options.min || 1,
    idleTimeoutMillis: options.idleTimeoutMillis || 30 * 1000
  })

  var Promise = r._bluebird

  function acquire () {
    console.log("rethinkdb-pool: acquire");
    return new Promise(function (resolve, reject) {
      pool.acquire(function (e, conn) {
        e ? reject(e) : resolve(conn)
      })
    }).disposer(function (conn) { pool.release(conn) })
  }

  pool.run = function (query, opt, done) {
    console.log("rethinkdb-pool: run: query=", query);
    if (typeof opt === 'function') {
      done = opt
      opt = null
    }

    var p = Promise.using(acquire(), function (conn) {
      return query.run(conn, opt)
    }).then(toArray)

    if (done) {
      p.then(function (d) {
        done(null, d)
      }).catch(done)
    } else {
      return p
    }
  }

  return pool
}
