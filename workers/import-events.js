'use strict';

const base64 = require('js-base64').Base64;
const co = require('co');
const delay = require('timeout-as-promise');
const request = require('request-promise');
const redis = require('redis').createClient();

const NBAPIKey = process.env.NB_API_KEY_1;
const NBNationSlug = process.env.NB_SLUG;
const APIKey = process.env.API_KEY;

var initUrl = `https://${NBNationSlug}.nationbuilder.com/api/v1/sites/${NBNationSlug}/pages/events?limit=100`;

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
 * Update event
 * @type {[type]}
 */
var updateEvent = co.wrap(function * (nbEvent) {
  console.log('Update event:' + nbEvent.id);

  // Which resource are we using on api.jlm2017.fr
  var resource = nbEvent.calendar_id === 3 ? 'groups' : 'events';

  // Construct our POST body
  var body = {
    id: nbEvent.id,
    name: nbEvent.name,
    path: nbEvent.path,
    tags: nbEvent.tags,
    published: (nbEvent.status.indexOf('publiée') !== -1),
    contact: {
      name: nbEvent.contact.name
    }
  };

  if (nbEvent.intro) {
    body.description = nbEvent.intro;
  }

  if (nbEvent.contact.show_phone && nbEvent.contact.phone) {
    body.contact.phone = nbEvent.contact.phone;
  }

  if (nbEvent.contact.show_email && nbEvent.contact.email) {
    body.contact.email = nbEvent.contact.email;
  }

  if (nbEvent.venue && nbEvent.venue.address && nbEvent.venue.address.lng &&
  nbEvent.venue.address.lat) {
    body.coordinates = {
      type: 'Point',
      coordinates: [
        Number(nbEvent.venue.address.lng),
        Number(nbEvent.venue.address.lat)
      ]
    };
    body.location = {
      name: nbEvent.venue.name,
      address: nbEvent.venue.address.address1 + ', ' + nbEvent.venue.address.zip + ' ' + nbEvent.venue.address.city
    };
  }

  if (nbEvent.calendar_id !== 3) {
    body.startTime = new Date(nbEvent.start_time).toUTCString();
    body.endTime = new Date(nbEvent.end_time).toUTCString();
    switch (nbEvent.calendar_id) {
    case 4:
      body.agenda = 'evenements_locaux';
      break;
    case 7:
      body.agenda = 'melenchon';
      break;
    case 15:
      body.agenda = 'reunions_circonscription';
      break;
    case 16:
      body.agenda = 'reunions_publiques';
      break;
    default:
      break;
    }
  }

  try {
    // Does the event already exist in the API ?
    let res = yield request.get({
      url: `http://localhost:5000/${resource}/${nbEvent.id}`,
      json: true,
      resolveWithFullResponse: true
    });

    yield request.put({
      url: `http://localhost:5000/${resource}/${res.body._id}`,
      body: body,
      headers: {
        'If-Match': res.body._etag,
        'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
      },
      json: true
    });
  } catch (err) {
    if (err.statusCode === 404) { // The event does not exists
      if (!body.published) return; // Do nothing is event is not published.

      yield request.post({ // Post the event on the API
        url: `http://localhost:5000/${resource}`,
        body: body,
        headers: {
          'Authorization': 'Basic ' + base64.encode(`${APIKey}:`)
        },
        json: true
      });
    }
  }
});

/**
 * Fetch next page of events
 * @param  {string} nextPage The URL of the next page.
 */
var fetchPage = co.wrap(function * (page) {
  var nextPage;
  try {
    var res = yield request({
      url: page + `&access_token=${NBAPIKey}`,
      headers: {Accept: 'application/json'},
      json: true,
      resolveWithFullResponse: true
    });
    yield throttle(res);

    console.log(`Fetched ${page}`);
    nextPage = res.body.next ?
      `https://${NBNationSlug}.nationbuilder.com${res.body.next}` :
      initUrl;
    redis.set('import-events-next-page', nextPage);

    for (var i = 0; i < res.body.results.length; i += 10) {
      yield res.body.results.slice(i, i + 10).map(nbEvent => {
        try {
          return updateEvent(nbEvent);
        } catch (err) {
          console.log(`Error while updating event ${nbEvent.id}:`, err.message);
        }

        return Promise.resolve();
      });
    }
  } catch (err) {
    console.log('Error while fetching page', page, err.message);
    yield delay(5000);
  } finally {
    fetchPage(nextPage || page);
  }
});

// Start
redis.get('import-events-next-page', (err, reply) => {
  if (err) console.log(err);

  fetchPage(reply || initUrl);
});
