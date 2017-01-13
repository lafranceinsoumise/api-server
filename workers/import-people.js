'use strict';

const request = require('request-promise');
const redis = require('redis').createClient();
const base64 = require('js-base64').Base64;
const co = require('co');

const NBAPIKey = 'f9a2e97d9852d51b9d3b7e000af6285afe59d3a3163026c84370cc885e13896a';
const NBNationSlug = 'plp';
const MailTrainKey = '907068facb88f555ff005261923f861079542ec6';
const APIKey = 'ethaelahz5Rei4seekiiGh1aipias6xohmohmaej9oodee6chahGh8ua3OorieCh';

const whiteList = [
  'créateur groupe d\'appui',
  'convention : cars',
  'convention : inscrit',
  'agir groupe d\'appui',
  'groupe d\'appuis certifié'
];

var initUrl = `https://${NBNationSlug}.nationbuilder.com/api/v1/people?limit=100&access_token=${NBAPIKey}`;

var updatePerson = co.wrap(function * (nbPerson) {
  if (!nbPerson.email) return;

  var body = {
    email: nbPerson.email,
    id: nbPerson.id,
    tags: nbPerson.tags
  };

  var events, groups;

  try {
    // Does the person already exist in the API ?
    let res = yield request.get({
      url: `http://localhost:5000/people/${nbPerson.id}`,
      json: true,
      headers: {
        Authorization: 'Basic ' + base64.encode(`${APIKey}:`)
      },
      resolveWithFullResponse: true
    });

    if (res.body.events && res.body.events.length > 0) events = 'evenements';
    if (res.body.groups && res.body.groups.length > 0) groups = 'groupe_appui';

    yield request.put({
      url: `http://localhost:5000/people/${res.body._id}`,
      body: Object.assign(res.body, body),
      headers: {
        'If-Match': res.body._etag,
        'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true
    });
  } catch (err) {
    if (err.statusCode === 404) { // The person does not exists
      try {
        return yield request.post({ // Post the person on the API
          url: 'http://localhost:5000/people',
          body: body,
          headers: {
            Authorization: 'Basic ' + base64.encode(`${APIKey}:`)
          },
          json: true
        });
      } catch (err) {
        console.error(`Error while creating ${nbPerson.email}:`, err.message);
      }
    }

    console.error(`Error while updating ${nbPerson.email}:`, err.message);
  }

  // Update mailtrain
  var action = nbPerson.email_opt_in === true ? 'subscribe' : 'unsubscribe';
  var tags = nbPerson.tags.filter(tag => (whiteList.indexOf(tag) !== -1));
  var zipcode = (nbPerson.primary_address &&
      nbPerson.primary_address.zip) || null;

  try {
    yield request.post({
      url: `https://newsletter.jlm2017.fr/api/${action}/SyWda9pi?access_token=${MailTrainKey}`,
      body: {
        EMAIL: nbPerson.email,
        MERGE_TAGS: tags,
        MERGE_ZIPCODE: zipcode,
        MERGE_INSCRIPTIONS: [events, groups].join(',')
      },
      json: true
    });
  } catch (err) {
    console.error(`Error updating ${nbPerson.email} on Mailtrain`, err.message);
  }
});

/**
 * Fetch next page of people
 * @param  {string} nextPage The URL of the next page.
 */
var fetchPage = co.wrap(function * (page) {
  var nextPage;
  try {
    var res = yield request({
      url: page,
      headers: {Accept: 'application/json'},
      json: true,
      resolveWithFullResponse: true
    });

    console.log(`Fetched ${page}`);
    nextPage = res.body.next ?
      `https://${NBNationSlug}.nationbuilder.com${res.body.next}&access_token=${NBAPIKey}` :
      initUrl;
    redis.set('import-people-next-page', nextPage);
    for (var i = 0; i < res.body.results.length; i += 30) {
      yield res.body.results.slice(i, i + 30).map(updatePerson);
    }
  } catch (err) {
    console.error('Error while fetching page', page, err.message);
  } finally {
    fetchPage(nextPage || page);
  }
});

redis.get('import-people-next-page', (err, reply) => {
  if (err) console.error(err);

  fetchPage(reply || initUrl);
});
