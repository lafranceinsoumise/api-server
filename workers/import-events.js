'use strict';

const co = require('co');
const delay = require('timeout-as-promise');
const request = require('request-promise');
const redis = require('redis').createClient();

const NBAPIKey = '3ef2a9dac9decd45857c59cd1fd1ec739a9cfbd725e2ad4e617076a8d4dfd932';
const NBNationSlug = 'plp';
const NBSiteSlug = 'plp';
const MailTrainKey = '907068facb88f555ff005261923f861079542ec6';

const whiteList = [
  'créateur groupe d\'appui',
  'convention : cars',
  'convention : inscrit'
];

var initUrl = `https://${NBNationSlug}.nationbuilder.com/api/v1/sites/${NBSiteSlug}/pages/events?limit=100&access_token=${NBAPIKey}`;

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
 * @type {[type]}
 */
var updateRSVP = co.wrap(function * (mailtrainTag, personId) {
  // Get email from te person nationbuilder id
  var r;
  try {
    r = yield request.get({
      url: `http://localhost:5000/people/${personId}`,
      json: true,
      resolveWithFullResponse: true
    });
  } catch (e) {
    console.log(e);
  }

  yield throttle(r);
  var email = r.body.person.email;
  if (!email) {
    return;
  }

  // Find tags and zipcode
  var tags = r.body.person.tags.filter(tag => (whiteList.indexOf(tag) !== -1));
  tags = tags.concat(mailtrainTag).join(', ');

  var zipcode = (r.body.person.primary_address &&
    r.body.person.primary_address.zip) || null;

  request.post({
    url: `https://newsletter.jlm2017.fr/api/subscribe/SyWda9pi?access_token=${MailTrainKey}`,
    body: {
      EMAIL: r.body.person.email,
      MERGE_TAGS: tags,
      MERGE_ZIPCODE: zipcode
    },
    json: true
  });
});

/**
 * Update event
 * @type {[type]}
 */
var updateEvent = co.wrap(function * (nbEvent) {
  console.log('Update event ' + nbEvent.id);

  // Which resource are we using on api.jlm2017.fr
  var resource = nbEvent.calendar_id === 3 ? 'groups' : 'events';

  // Construct our POST body
  var body = {
    id: nbEvent.id,
    name: nbEvent.name,
    slug: nbEvent.slug,
    path: nbEvent.path,
    tags: nbEvent.tags,
    published: (nbEvent.status.indexOf('publiée') !== -1),
    contact: {
      name: nbEvent.contact.name
    }
  };

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
  }

  if (nbEvent.calendar_id !== 3) {
    body.startTime = new Date(nbEvent.start_time).toUTCString();
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
        'If-Match': res.body._etag
      },
      json: true
    });
  } catch (err) { // The event does not exists
    if (err.statusCode !== 404) throw err;

    if (!body.published) { // Do nothing is event is not published.
      return;
    }

    yield request.post({ // Post the event on the API
      url: `http://localhost:5000/${resource}`,
      body: body,
      json: true
    });
  }

  // Update RSVPs
  var mailtrainTag = (resource === 'groups' ? 'groupes_appui' : body.agenda);
  var res = yield request.get({
    url: `https://${NBNationSlug}.nationbuilder.com/api/v1/sites/${NBSiteSlug}/pages/events/${nbEvent.id}/res?limit=100&access_token=${NBAPIKey}`,
    json: true,
    resolveWithFullResponse: true
  });

  yield throttle(res);

  for (var i = 0; i < res.body.results.length; i++) {
    yield updateRSVP(mailtrainTag, res.body.results[i].person_id);
  }
});

/**
 * Fetch next page of events
 * @param  {string} nextPage The URL of the next page.
 */
var fetchPage = co.wrap(function * (nextPage) {
  try {
    var res = yield request({
      url: nextPage,
      headers: {Accept: 'application/json'},
      json: true,
      resolveWithFullResponse: true
    });
    yield throttle(res);

    console.log(`Fetched ${nextPage}`);

    for (var i = 0; i < res.body.results.length; i += 10) {
      try {
        yield res.body.results.slice(i, i + 10).map(updateEvent);
      } catch (e) {
        console.log(e.name);
      }
    }

    nextPage = res.body.next ?
      `https://${NBNationSlug}.nationbuilder.com${res.body.next}&access_token=${NBAPIKey}` :
      initUrl;

    redis.set('import-events-next-page', nextPage);
  } catch (err) {
    console.log(err.name);
  } finally {
    fetchPage(nextPage);
  }
});

// Start
redis.get('import-events-next-page', (err, reply) => {
  if (err) console.log(err);

  fetchPage(reply || initUrl);
});
