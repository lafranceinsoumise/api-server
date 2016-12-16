'use strict';

const co = require('co');
const base64 = require('js-base64').Base64;
const delay = require('timeout-as-promise');
const request = require('request-promise');

const NBAPIKey = '3ef2a9dac9decd45857c59cd1fd1ec739a9cfbd725e2ad4e617076a8d4dfd932';
const NBNationSlug = 'plp';
const MailTrainKey = '907068facb88f555ff005261923f861079542ec6';
const APIKey = 'ethaelahz5Rei4seekiiGh1aipias6xohmohmaej9oodee6chahGh8ua3OorieCh';

const whiteList = [
  'créateur groupe d\'appui',
  'convention : cars',
  'convention : inscrit'
];

var throttle = co.wrap(function * (res) {
  if (res.headers['x-ratelimit-remaining'] < 10) {
    var delayTime = res.headers['x-ratelimit-reset'] * 1000 -
      (new Date(res.headers.expires).getTime());
    console.log('Pause during ' + delayTime);
    yield delay(delayTime);
    console.log('Pause end.');
  }
});

/**
 * Update RSVP
 */
var updateRSVP = co.wrap(function * (mailtrainTag, personId) {
  // Get email from te person nationbuilder id
  var r;
  try {
    r = yield request.get({
      url: `http://localhost:5000/people/${personId}`,
      headers: {
        Authorization: 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true,
      resolveWithFullResponse: true
    });
  } catch (err) {
    console.log(`Error while fetching person ${personId} email:`, err.message);
    return;
  }

  var email = r.body.email;
  if (!email) {
    return;
  }

  // Find tags and zipcode
  var tags = r.body.tags.filter(tag => (whiteList.indexOf(tag) !== -1));
  tags = tags.concat(mailtrainTag).join(', ');

  var zipcode = (r.body.primary_address &&
    r.body.primary_address.zip) || null;

  request.post({
    url: `https://newsletter.jlm2017.fr/api/subscribe/SyWda9pi?access_token=${MailTrainKey}`,
    body: {
      EMAIL: r.body.email,
      MERGE_TAGS: tags,
      MERGE_ZIPCODE: zipcode
    },
    json: true
  });
});

/**
 * Get RSVPS
 */
var getRSVPS = co.wrap(function * (resource, item) {
  // Update RSVPs
  var mailtrainTag = (resource === 'groups' ? 'groupes_appui' : item.agenda);
  var res = yield request.get({
    url: `https://${NBNationSlug}.nationbuilder.com/api/v1/sites/${NBNationSlug}/pages/events/${item.id}/rsvps?limit=100&access_token=${NBAPIKey}`,
    json: true,
    resolveWithFullResponse: true
  });

  yield throttle(res);

  for (var i = 0; i < res.body.results.length; i++) {
    yield updateRSVP(mailtrainTag, res.body.results[i].person_id);
  }
});

/**
 * Fetch events
 */
var fetchEvents = co.wrap(function * (resource) {
  try {
    var res = yield request({
      url: `http://localhost:5000/${resource}`,
      headers: {Accept: 'application/json'},
      json: true,
      resolveWithFullResponse: true
    });

    console.log(`Fetched all events.`);

    for (var i = 0; i < res.body.results.length; i += 10) {
      yield res.body._items.slice(i, i + 10).map(item => {
        try {
          return getRSVPS(resource, item);
        } catch (err) {
          console.log(`Error while updating event ${item.id}:`, err.message);
        }

        return Promise.resolve();
      });
    }
  } catch (e) {
    console.log(e.message);
  } finally {
    return fetchEvents(resource === 'events' ? 'groups' : 'events');
  }
});
