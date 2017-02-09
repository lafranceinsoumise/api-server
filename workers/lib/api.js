const co = require('co');
const request = require('request-promise');
const requestErrors = require('request-promise/errors');
const base64 = require('js-base64').Base64;
const winston = require('winston');
const escape = require('url-escape-tag');

const HOST = 'localhost:5000';
const SCHEME = 'http';

function encodeAPIKey(APIKey) {
  return 'Basic ' + base64.encode(`${APIKey}:`);
}

function logError(err) {
  if(err instanceof requestErrors.StatusCodeError) {
    let res = {
      message: err.message,
      options: err.options,
      headers: err.response.headers,
      request: err.response.toJSON().request,
      body: err.response.body,
    };
    try {
      res.response = JSON.parse(err.response.body);
    } catch(err) {}
    return res;
  } else {
    return {message: err.message};
  }
}
exports.logError = logError;

/**
 * get_resource
 */
exports.get_resource = co.wrap(function*({resource, id, where, APIKey, resolveWithFullResponse}) {
  if (resource == null) {
    throw new Error('get_resource cannot be called without resource');
  }

  resolveWithFullResponse = resolveWithFullResponse || false;

  let url = `${SCHEME}://${HOST}/${resource}/`;
  if (id != null) {
    url = `${url}${id}`;
  }
  if (where != null) {
    let escapedWhere = escape`${where}`;
    url = `${url}?where=${escapedWhere}`;
  }

  const req = {
    url,
    headers: {},
    json: true,
    resolveWithFullResponse
  };

  if (APIKey) {
    req.headers['Authorization'] = encodeAPIKey(APIKey);
  }

  try {
    return yield request.get(req);
  } catch(err) {
    winston.debug('API - get_resource failed', Object.assign({resource, id, where}, logError(err)));
    throw err;
  }
});

/**
 * post_resource
 */
exports.post_resource = co.wrap(function*(resource, post, options) {
  let {APIKey} = options;
  if (!APIKey) {
    throw new Error('Cannot POST without an API Key');
  }

  let req = {
    url: `${SCHEME}://${HOST}/${resource}`,
    body: post,
    headers: {
      'Authorization': encodeAPIKey(APIKey)
    },
    json: true
  };

  try {
    yield request.post(req);
  } catch (err) {
    winston.debug('API - post_resource failed', Object.assign({resource, post}, logError(err)));
    throw err;
  }

});

/**
 * patch_resource
 *
 * patch an item with some new_props
 * Fetch the item with cache bypass and patch again if first try
 * returns a 412 error (etag doesn't match)
 * @type {Function}
 */
exports.patch_resource = co.wrap(function*(resource, item, patch, APIKey) {
  let {_id: id, _etag: etag} = item;

  try {
    yield request.patch({
      url: `http://localhost:5000/${resource}/${id}`,
      body: patch,
      headers: {
        'If-Match': etag,
        'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true
    });

    // if first patch succeeded, nothing else to do
    return;

  } catch (err) {
    if (err.statusCode !== 412) {
      winston.debug('API - patch resource failed', Object.assign({resource, id, patch}, logError(err)));
      throw err;
    }
  }

  let new_etag = null;

  try {
    winston.debug('API - failed patching but retrying', {resource, id, patch});
    let res = yield request.get({
      url: `http://localhost:5000/${resource}/${id}`,
      headers: {
        'Cache-Control': 'no-cache',
        'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true,
      resolveWithFullResponse: true
    });

    new_etag = res.body._etag;

    yield request.patch({
      url: `http://localhost:5000/${resource}/${id}`,
      body: patch,
      headers: {
        'If-Match': new_etag,
        'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true
    });
  } catch (err) {
    winston.warn(
      'API - failed patching after retry',
      Object.assign({resource, id, patch, fist_etag: etag, second_etag: new_etag}, logError(err))
    );
    throw err;
  }
});
