'use strict';

const request = require('request-promise');

const NBAPIKey = 'e2e9cdeb3f70012949c6e90dc69b028d739846f8dad45ceee44e4e78d22c0533';
const NBNationSlug = 'plp';

var initUrl = `https://${NBNationSlug}.nationbuilder.com/api/v1/people?limit=100&access_token=${NBAPIKey}`;

/**
 * Fetch next page of people
 * @param  {string} nextPage The URL of the next page.
 */
function fetchPage(nextPage) {
  setTimeout(() => {
    fetchPage();
  }, 1000);

  return;

  request({
    url: nextPage,
    headers: {Accept: 'application/json'},
    json: true,
    resolveWithFullResponse: true
  })
  .then(function(res) {
    console.log(`Fetched ${nextPage}`);
    res.body.results.forEach(result => {
      var body = {
        email: result.email
      };

      request.post({
        url: 'http://localhost:5000/people',
        body: body,
        json: true
      });
    });

    var next = res.body.next ?
      `https://${NBNationSlug}.nationbuilder.com${res.body.next}&access_token=${NBAPIKey}` :
      initUrl;

    var time;
    time = res.headers['Nation-Ratelimit-Reset'] * 1000 - new Date().getTime();
    time /= res.headers['Nation-Ratelimit-Remaining'];
    setTimeout(() => {
      fetchPage(next);
    }, 10000);
  })
  .catch(err => {
    // TODO
    console.log(err);
    // Crawling failed...
  });
}

fetchPage(initUrl);
