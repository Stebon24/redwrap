/*====================================
 =      Requester.js      =
 ====================================*/

/*==========  MODULES  ==========*/

var request = require('request'),
  EventEmitter = require('events').EventEmitter,
  // util = require('util'),
  // qs = require('querystring'),
  url = require('url');



/*==========  CONSTRUCTOR  ==========*/

var Requester = function (path, options) {

  options = options || {};
  this.debug = !!options.debug;
  this.userAgent = options.userAgent || "redwrap";

  this.ee = new EventEmitter();
  this.path = path || '/';
  this.filter = '';
  this.url = {
    protocol: 'http',
    host: 'www.reddit.com',
    pathname: path + '.json',
    query: options.query || {}
  };

};

Requester.prototype.setUserAgent = function(userAgent){
  this.userAgent = userAgent;
  return this;
};

Requester.prototype.setQuery = function(query){
  this.url.query = query;
  return this;
};

Requester.prototype.setOptions = function(opts){
  Object.keys(opts).forEach(function(key){
    this[key] = opts[key];
  });
  return this;
};


/*========== @REQUEST EXECUTION METHODS  ==========*/

//executes a single request
Requester.prototype.exe = function (cb) {
  var // query = qs.stringify(this.url.query),
  reqUrl = url.format(this.url),
  parsedBody = '';

  var data = {
    uri: reqUrl,
    headers: {
      'User-Agent': this.userAgent
    }
  };

  request(data, function (err, res, body) {
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      return cb(parseError, null);
    }
    cb(err, parsedBody, res);
  });
};

//executes multiple requests
Requester.prototype.all = function (cb) {
  var limit = this.url.query.limit;
  this.url.query.limit = (limit) ? limit : 100; //default max limit, 100

  cb(this.ee);

  this.collector();
};

/*
 collector calls itself recursivly to make multiple requests when
 it becomes actiavted by the .all() method. It emits a data event
 each time a request completes and passes the response data to the event
 listener.

 */

Requester.prototype.collector = function () {
  var that = this,
  reqUrl = url.format(that.url),
  parsedBody = '',
  nextAfter = '',
  prevAfter = '';

  if(that.debug){
    console.log('Requesting: ' + reqUrl);
  }

  var data = {
    uri: reqUrl,
    headers: {
      'User-Agent': this.userAgent
    }
  };

  request(data, function (error, res, body) {
    if (error) {
      return that.ee.emit('error', error);
    }

    if(!error && res.statusCode === 200) {
      try {
      parsedBody = JSON.parse(body);
      }
      catch (parseError) {
      return that.ee.emit('error', parseError);
      }

      that.ee.emit('data', parsedBody, res);

      if (parsedBody.data.after) {
      nextAfter = parsedBody.data.after;
      prevAfter = that.url.query.after;
      that.url.query.after = nextAfter;

      return (nextAfter !== prevAfter) ? //a check to see if we are done
        that.collector() : that.ee.emit('end');
      }
      return that.ee.emit('end');
    }
  });
};


/*========== @QUERY OPTIONS  ==========*/

var queries = [
  'sort',
  'from',
  'limit',
  'after',
  'before',
  'count',
];

queries.forEach(function (query) {
  if (query === 'from') {
    Requester.prototype.from = function (value, cb) {
      this.url.query.t = value;
      return (cb) ? this.exe(cb) : this;
    };
  } else {
    Requester.prototype[query] = function (value, cb) {
      this.url.query[query] = value;
      return (cb) ? this.exe(cb) : this;
    };
  }
});


/*==========  FILTERS  ==========*/

var filters = [
  //user
  'overview',
  'comments',
  'submitted',
  'liked',
  'disliked',
  'hidden',
  'saved',
  'about',
  //r
  'hot',
  'new',
  'controversial',
  'top',
];

filters.forEach(function (filter) {
  Requester.prototype[filter] = function (cb) {
    if (this.filter) {
      throw "Only one filter can be applied to a query.";
    }
    this.filter = filter;
    this.url.pathname = this.path + this.filter + '/.json';

    return (cb) ? this.exe(cb) : this;
  };
});


/*==========  EXPORTS  ==========*/

exports.Requester = Requester;
