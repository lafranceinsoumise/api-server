'use strict';

const co = require('co');
const base64 = require('js-base64').Base64;
const delay = require('timeout-as-promise');
const request = require('request-promise');

const NBAPIKey = '8590e41fd59899ea739b57ac072b13fd635e010e2f3932c10db9e25555efb4e6';
const NBNationSlug = 'plp';
const APIKey = 'ethaelahz5Rei4seekiiGh1aipias6xohmohmaej9oodee6chahGh8ua3OorieCh';

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
var updateRSVP = co.wrap(function * (resource, eventId, personId) {
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
    console.error(`Error while fetching person ${personId} email:`, err.message);
    return;
  }

  var email = r.body.email;
  if (!email) {
    return;
  }

  var body = {};
  body[resource] = [...new Set(r.body.events)].concat(eventId);

  try {
    yield request.patch({
      url: `http://localhost:5000/people/${r.body._id}`,
      body: body,
      headers: {
        'If-Match': r.body._etag,
        'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true
    });
  } catch (err) {
    console.error(`Error while updating person ${personId} rsvps:`, err.message);
  }
});

/**
 * Get RSVPS
 */
var getRSVPS = co.wrap(function * (resource, item) {
  // Update RSVPs
  try {
    var res = yield request.get({
      url: `https://${NBNationSlug}.nationbuilder.com/api/v1/sites/${NBNationSlug}/pages/events/${item.id}/rsvps?limit=100&access_token=${NBAPIKey}`,
      json: true,
      resolveWithFullResponse: true
    });

    yield throttle(res);

    for (var i = 0; i < res.body.results.length; i++) {
      yield updateRSVP(resource, item._id, res.body.results[i].person_id);
    }
  } catch (err) {
    console.error(`Error while fetching event ${item.id} rsvps:`, err.message);
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

    console.log(`Fetched all ${resource}.`);

    for (var i = 0; i < res.body._items.length; i += 10) {
      yield res.body._items.slice(i, i + 10).map(item => {
        try {
          return getRSVPS(resource, item);
        } catch (err) {
          console.log(`Error while updating event ${item.id}:`, err.message);
        }

        return Promise.resolve();
      });
    }

    console.log(`Updated ${i} persons.`);
  } catch (e) {
    console.log(e.message);
  } finally {
    fetchEvents(resource === 'events' ? 'groups' : 'events');
  }
});

fetchEvents('events');
