/**
 * Author: pxdog
 * Blog: https://px.dog
 * Description: Node.js, Apache and other servers can coexist via this proxy server.
 * GitHub: https://github.com/pxdog/nodejs-with-apache
 * LastUpdate: 2018/06/01
 * Licence: MIT
 * Usage: sudo npm run (sudo forever start proxy-server.js)
 * Version: v2.0.0
 */


/**
 * param = {
 *   config: config file json  ex. require('./config.json')
 *   tls_reject: ignore unauthorized tls  ex. true / false
 *   test_mode: test mode shows target url and remote ip  ex. true / false
 * }
 * 
 * */
const start = (param) => {
  const https = require('https')
  const url = require('url')
  const fs = require('fs')
  const tls = require('tls')
  const util = require('util')
  const zlib = require('zlib')
  
  const DEFAULT_PORT = 8443
  const PROXY_SERVER_PORT = 443
  
  /** argments */
  const config = param.config == null? require('./config.json'): param.config
  const TLS_REJECT = param.tls_reject == true? true: false
  if(TLS_REJECT === true) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }
  const TEST_MODE = param.test_mode == true? true: false
  console.log('TLS_REJECT_UNAUTHORIZED: ' + TLS_REJECT)  
  console.log('TEST_MODE: ' + TEST_MODE)  

  let groupList = {}
  for (let group in config) {
    const groupJson = config[group]
    let hostList = { port: groupJson['port'], list: [] }
    groupList[groupJson['title']] = hostList
    for (let index in groupJson['host']) {
      const hostJson = groupJson['host'][index]
      /** reading certificate file may need privilege */
      hostList.list[hostJson['hostname']] = {
        credential: tls.createSecureContext({
          key: fs.readFileSync(hostJson['key']),
          cert: fs.readFileSync(hostJson['cert'])
        }),
        denied: hostJson['denied'],
        allowed: hostJson['allowed']
      }
    }
  }
  console.log('config loaded: ' + util.inspect(groupList))

  /** https server setting */
  var credential = {
    SNICallback: function (hostname, cb) {
      for (let group in groupList) {
        if (hostname in groupList[group]['list']) {
          return cb(null, groupList[group]['list'][hostname]['credential'])
        }
      }
      /** this shows "protocol not supported" on browser */
      return cb(null, null)
    }
  }

  /** https server */
  https.createServer(credential, function (req, res) {
    const hostname = req.headers.host.split(":")[0]
    let port = DEFAULT_PORT
    let denied = []
    let allowed = []

    /** check request's hostname is in config.json or not */
    for (let group in groupList) {
      if (hostname in groupList[group]['list']) {
        port = groupList[group]['port']
        denied = groupList[group]['list'][hostname]['denied']
        allowed = groupList[group]['list'][hostname]['allowed']          
        break
      }
    }


    const queryString = req.url.indexOf('?') >= 0 ? req.url.replace(/^.*\?/, '?') : ''
    const parsedUrl = url.parse(req.url)
    /** IPv4 only */
    const remoteAddress = req.connection.remoteAddress.replace(/^::ffff:/, '')

    if(denied != null) {
      if(denied.indexOf(remoteAddress) >= 0) {
        /** if "denied" exists and ip is in denied then exit */
        console.log('reject from ' + remoteAddress + ' to ' + hostname)
        res.writeHead(403, {})
        res.end('403 Forbidden')
        return         
      }
    }
    if(allowed != null) {
      if(allowed.indexOf(remoteAddress) < 0) {
        /** if "allowed" exists and ip is not in allowed then exit */
        console.log('reject from ' + remoteAddress + ' to ' + hostname)
        res.writeHead(403, {})
        res.end('403 Forbidden')
        return 
      }
    }


    if (TEST_MODE) {
      /** show where proxy access */
      const target = 'https://' + hostname + ':' + port + parsedUrl.pathname + queryString
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
      headers: headers,
      method: req.method
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
    /** Transfer post data from client to server */
    req.on('data', function (data) {
      proxyReq.write(data);
    })
    req.on('end', function () {
      proxyReq.end()
    })

    /** if error proxy returns 502 Bad Gateway */
    proxyReq.on('error', function (err) {
      console.log('error: ' + err.message)
      res.writeHead(502, {})
      res.end('502 Bad Gateway')
    })

  }).listen(PROXY_SERVER_PORT, function () {
    /** this proxy server uses 443 so privilege is necessary (use sudo) */
    console.log('proxy server listen to port ' + PROXY_SERVER_PORT)
  })

}

if(module.parent) {
  module.exports = {
    start: start
  }
} else {
  const test_mode = false;
  if (process.argv.length > 2 && process.argv[2] === 'test') {
    test_mode = true
  }
  start({
    config: require('./config.json'), 
    test_mode: test_mode,
    tls_reject: true
  })
}
