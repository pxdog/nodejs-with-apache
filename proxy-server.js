/**
 * Author: pxdog
 * Blog: https://px.dog
 * Description: Node.js, Apache and other servers can coexist via this proxy server.
 * GitHub: https://github.com/pxdog/nodejs-with-apache
 * LastUpdate: 2018/06/01
 * Licence: MIT
 * Usage: sudo npm run (sudo forever start proxy-server.js)
 */

const https = require('https')
const url = require('url')
const fs = require('fs')
const tls = require('tls')
const util = require('util')
const zlib = require('zlib')

const config = require('./config.json')
const DEFAULT_PORT = 8443
const DEFAULT_SERVER = 'localhost'
const PROXY_SERVER_PORT = 443

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
let TEST_MODE = false
if(process.argv.length > 2 && process.argv[2] === 'test') {
  TEST_MODE = true
}
console.log('TEST_MODE: ' + TEST_MODE)

/** read config.json to groupList */
let groupList = {}
for (let group in config) {
  const groupJson = config[group]
  let hostList = { port: groupJson['port'], list: [] }
  groupList[groupJson['title']] = hostList
  for (let index in groupJson['host']) {
    const hostJson = groupJson['host'][index]
    /** reading certificate file may need privilege */
    hostList.list[hostJson['hostname']] = tls.createSecureContext({
      key: fs.readFileSync(hostJson['key']),
      cert: fs.readFileSync(hostJson['cert'])
    })
  }
}
console.log('config loaded: ' + util.inspect(groupList))

/** https server setting */
var credential = {
  SNICallback: function (hostname, cb) {
    for (let group in groupList) {
      if (hostname in groupList[group]['list']) {
        return cb(null, groupList[group]['list'][hostname])
      }
    }
    throw Error('hostname not found')
  }
}

/** https server */
https.createServer(credential, function (req, res) {
  const hostname = req.headers.host.split(":")[0]
  let port = DEFAULT_PORT
  let server = DEFAULT_SERVER

  /** check request's hostname is in config.json or not */
  for (let group in groupList) {
    if (hostname in groupList[group]['list']) {
      port = groupList[group]['port']
      server = groupList[group]['server']
    }
  }

  const queryString = req.url.indexOf('?') >= 0 ? req.url.replace(/^.*\?/, '?') : ''
  const parsedUrl = url.parse(req.url)
  /** IPv4 only */
  const remoteAddress = req.connection.remoteAddress.replace(/^::ffff:/, '')

  if (TEST_MODE) {
    /** show where proxy access */
    const target = 'https://' + server + ':' + port + parsedUrl.pathname + queryString
    console.log('request to: ' + target)
    console.log('remote address: ' + remoteAddress)  
  }

  let proxyReq = null
  let headers = req.headers

  /** act like a proxy server */
  if (headers['x-forwarded-for'] == null) {
    headers['x-forwarded-for'] = remoteAddress
  }
  const option = {
    hostname: hostname,
    port: port,
    path: parsedUrl.pathname + queryString,
    headers: headers
  }

  proxyReq = https.request(option, function (proxyRes) {
    /** return statusCode and headers to client as it is from server */
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.on('data', function (data) {
      res.write(data)
    })
    proxyRes.on('end', function () {
      res.end()
    })
  })

  /** if error proxy returns 502 Bad Gateway */
  proxyReq.on('error', function (err) {
    console.log('error: ' + err.message)
    res.writeHead(502, {})
    res.end('502 Bad Gateway')
  })

  proxyReq.end()

}).listen(PROXY_SERVER_PORT, function () {
  /** this proxy server uses 443 so privilege is necessary (use sudo) */
  console.log('proxy server listen to port ' + PROXY_SERVER_PORT)
})

