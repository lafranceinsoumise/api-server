const co = require('co');
const request = require('request-promise');
const winston = require('winston');
const delay = require('timeout-as-promise');

const fetcher = co.wrap(function *(pageUrl, NBAPIKey) {
  const res = yield request.get({
    url: pageUrl + `&access_token=${NBAPIKey}`,
    headers: {Accept: 'application/json'},
    json: true,
    resolveWithFullResponse: true
  });

  winston.debug(`Fetched ${pageUrl}`);

  return res;
});

/**
 *
 * @param slug the NationBuilder slug
 * @param resource the type of resource to fetch
 * @param options contains the three options NBAPIKey, limit, and retries
 * @returns {*}
 *
 * This function returns a function without argument, fetchNextPage
 * When called, it returns a Promise that will resolve with an array
 * containing the content of the page, and a second element which is either:
 * - null, if there is no other page to fetch
 * - a new fetchNextPage function.
 */
exports.fetchAll = function (slug, resource, options) {
  const NBAPIKey = options.NBAPIKey;
  const limit = options.limit || 100;
  const retries = options.retries || 4;

  let baseUrl = `https://${slug}.nationbuilder.com`;
  let initUrl = `${baseUrl}/api/v1/${resource}?limit=${limit}`;

  let closure = function*(url, retry = retries) {
    try {
      let res = yield fetcher(url, NBAPIKey);
      yield exports.throttle(res);

      let {results, next} = res.body;

      if (next) {
        // there is a next page to fetch after this one
        let gen = closure(`${baseUrl}${next}`);
        // return argumentless function to schedule the generator at the last time!
        return [results, () => (co(gen))];
      } else {
        // there is nothing else to fetch
        return [results, null];
      }
    } catch (err) {
      // there was an error while fetching the page
      if (retry) {
        // let's first wait for a bit
        winston.info(`Failed fetching page ${url}... ${retry} retries left`);
        yield delay(5000);
        // and then retry the same url
        let gen = closure(url, retry-1);
        // return argumentless function to schedule the generator at the last time!
        return [null, () => co(gen)];
      } else {
        winston.error(`Failed fetching page ${url} after ${retries+1} trials`);
        throw err;
      }
    }
  };

  let gen = closure(initUrl);
  return () => (co(gen));
};

exports.throttle = co.wrap(function*(res) {
  if (res.headers['x-ratelimit-remaining'] < 10) {
    let delayTime = res.headers['x-ratelimit-reset'] * 1000 -
      (new Date(res.headers.expires).getTime());
    winston.debug('Pause during ' + delayTime);
    yield delay(delayTime);
    winston.debug('Pause end.');
  }
});
