var fs = require('fs');
var http = require('http');
var https = require('https');
var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
var express = require('express')
var credentials = {key: privateKey, cert: certificate};
var path = require('path');
var Cacheman = require('cacheman')
var FileCache = require('cacheman-file')
var sortedObject = require('sorted-object')
var hash = require('object-hash');
var google = require('googleapis')
var search = google.customsearch({
  version: 'v1',
  params: { auth: process.env.CSE_AUTH, cx: process.env.CSE_CX }
});

if (!process.env.CSE_AUTH || !process.env.CSE_CX) {
    console.error('Specify CSE_AUTH and CSE_CX environmental variables to run google search');
    process.exit();
}

var app = express()
var cache = new Cacheman('search', {
    ttl: 86400,
    engine: new FileCache({
        tmpDir: path.join(process.cwd(), 'cache')
    })
})

const CACHE_STATUS_HEADER = 'X-Cache-Status';

var cacheKey = function(req) {
    return hash(sortedObject(req.query))
}

var cacheMiddleware = function(req, res, next) {
    if (!req.query.q) {
        res.status(400).end();
        return console.log('No query specified');
    }

    cache.get(cacheKey(req), (err, value) => {
        if (err || value === null) {
            next()
        } else {
            res.set(CACHE_STATUS_HEADER, 'Hit').send(value)  
        }  
    })
}

var proxyMiddleware = function(req, res, next) {    
    res.set(CACHE_STATUS_HEADER, 'Miss');
    var key = cacheKey(req);
    var query = req.query;
    if (!query.siteSearch) {
        query.q += (query.lang === 'ru' ? ' site:kb.x-cart.ru OR site:devs.x-cart.ru' : ' site:kb.x-cart.com OR site:devs.x-cart.com');        
    }

    console.log(query);

    search.cse.list(query, (err, search) => {
        cache.set(key, search);
        res.send(search);
    })
}

var handler = [cacheMiddleware, proxyMiddleware];

app.use('/search', handler)

var credentials = {key: privateKey, cert: certificate};

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(process.env.HTTP_PORT);
httpsServer.listen(process.env.HTTPS_PORT);