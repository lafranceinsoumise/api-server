'use strict';

const request = require('request-promise');
const redis = require('redis').createClient();

const NBAPIKey = 'e2e9cdeb3f70012949c6e90dc69b028d739846f8dad45ceee44e4e78d22c0533';
const NBNationSlug = 'plp';
const MailTrainKey = '907068facb88f555ff005261923f861079542ec6';

const whiteList = [
  'créateur groupe d\'appui',
  'convention : cars',
  'convention : inscrit'
];

var initUrl = `https://${NBNationSlug}.nationbuilder.com/api/v1/people?limit=100&access_token=${NBAPIKey}`;

/**
 * Fetch next page of people
 * @param  {string} nextPage The URL of the next page.
 */
function fetchPage(nextPage) {
  request({
    url: nextPage,
    headers: {Accept: 'application/json'},
    json: true,
    resolveWithFullResponse: true
  })
  .then(function(res) {
    console.log(`Fetched ${nextPage}`);

    var count = {
      subscribe: 0,
      unsubscribe: 0
    };

    res.body.results.forEach(result => {
      if (result.email) {
        // Update mailtrain
        var action = result.email_opt_in === true ? 'subscribe' : 'unsubscribe';
        request.post({
          url: `https://newsletter.jlm2017.fr/api/${action}/SyWda9pi?access_token=${MailTrainKey}`,
          body: {
            EMAIL: result.email,
            MERGE_TAGS: result.tags.filter(tag => (whiteList.includes(tag))).join(', '),
            MERGE_ZIPCODE: (result.primary_address && result.primary_address.zip) || null
          },
          json: true
        });

        count[action]++;
      }

      /* request.post({
        url: 'http://localhost:5000/people',
        body: body,
        json: true
      }); */
    });

    console.log(
      `Subcribed ${count.subscribe} people ` +
      `and unsubscribed ${count.unsubscribe}.`
    );

    nextPage = res.body.next ?
      `https://${NBNationSlug}.nationbuilder.com${res.body.next}&access_token=${NBAPIKey}` :
      initUrl;

    redis.set('import-people-next-page', nextPage);
  })
  .catch(err => {
    // Crawling failed
    console.log(err);
  })
  .finally(() => {
    setTimeout(() => {
      fetchPage(nextPage);
    }, 1000);
  });
}

redis.get('import-people-next-page', (err, reply) => {
  if (err) console.log(err);

  fetchPage(reply || initUrl);
});
