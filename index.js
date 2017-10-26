var express = require('express')
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

    var query = req.query;
    if (!query.siteSearch) {
        query.q += ' site:kb.x-cart.com OR site:devs.x-cart.com';        
    }

    console.log(query);

    search.cse.list(query, (err, search) => {
        cache.set(cacheKey(req), search);
        res.send(search);
    })
}

var handler = [cacheMiddleware, proxyMiddleware];

app.use('/search', handler)

app.listen(process.env.PORT || 3000, function () {
  console.log('Google Search caching proxy has started successfully')
})