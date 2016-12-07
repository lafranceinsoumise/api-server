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

var updateRSVP = co.wrap(function * (eventTag, personId) {
  var res = yield request.get({
    url: `https://${NBNationSlug}.nationbuilder.com/api/v1/people/${personId}?&access_token=${NBAPIKey}`,
    json: true,
    resolveWithFullResponse: true
  });

  if (res.headers['x-ratelimit-remaining'] < 10) {
    var delayTime = res.headers['x-ratelimit-reset'] * 1000 -
      (new Date(res.headers.expires).getTime());
    console.log('Pause during ' + delayTime);
    yield delay(delayTime);
    console.log('Pause end.');
  }

  var email = res.body.person.email;
  if (!email) {
    return;
  }

  var tags = res.body.person.tags.filter(tag => (-1 !== whiteList.indexOf(tag)));
  tags = tags.concat(eventTag).join(', ');

  request.post({
    url: `https://newsletter.jlm2017.fr/api/subscribe/SyWda9pi?access_token=${MailTrainKey}`,
    body: {
      EMAIL: res.body.person.email,
      MERGE_TAGS: tags,
      MERGE_ZIPCODE: (res.body.person.primary_address && res.body.person.primary_address.zip) || null
    },
    json: true
  });
});

/**
 * Update event
 * @type {[type]}
 */
var updateEvent = co.wrap(function * (result) {
  console.log('Update event ' + result.id);
  var resource = result.calendar_id === 3 ? 'groups' : 'events';

  var body = {
    id: result.id,
    name: result.name,
    slug: result.slug,
    path: result.path,
    tags: result.tags,
    published: (result.status.indexOf('publiée') !== -1),
    contact: {
      name: result.contact.name
    }
  };

  if (result.contact.show_phone && result.contact.phone) {
    body.contact.phone = result.contact.phone;
  }

  if (result.contact.show_email && result.contact.email) {
    body.contact.email = result.contact.email;
  }

  if (result.venue && result.venue.address && result.venue.address.lng &&
  result.venue.address.lat) {
    body.coordinates = {
      type: 'Point',
      coordinates: [
        Number(result.venue.address.lng),
        Number(result.venue.address.lat)
      ]
    };
  }

  if (result.calendar_id !== 3) {
    body.startTime = new Date(result.start_time).toUTCString();
    switch (result.calendar_id) {
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

  var tag = (resource === 'groups' ? 'groupes_appui' : body.agenda);
  if (tag) {
    var rsvps = yield request.get({
      url: `https://${NBNationSlug}.nationbuilder.com/api/v1/sites/${NBSiteSlug}/pages/events/${result.id}/rsvps?limit=100&access_token=${NBAPIKey}`,
      json: true,
      resolveWithFullResponse: true
    });

    if (rsvps.headers['x-ratelimit-remaining'] < 10) {
      var delayTime = rsvps.headers['x-ratelimit-reset'] * 1000 -
        (new Date(rsvps.headers.expires).getTime());
      console.log('Pause during ' + delayTime);
      yield delay(delayTime);
      console.log('Pause end.');
    }

    for (var i = 0; i < rsvps.body.results.length; i++) {
      yield updateRSVP(tag, rsvps.body.results[i].person_id);
    }
  }

  try {
    var res = yield request.get({
      url: `http://localhost:5000/${resource}/${result.id}`,
      json: true,
      resolveWithFullResponse: true
    });

    body._id = res.body._id;
    try {
      require('assert').deepEqual(body, res.body);
    } catch (e) {
      return request.put({
        url: `http://localhost:5000/${resource}/${res.body._id}`,
        body: body,
        headers: {
          'If-Match': res.body._etag
        },
        json: true
      });
    }
  } catch (err) {
    if (err.statusCode !== 404) throw err;

    if (!body.published) {
      return;
    }

    return request.post({
      url: `http://localhost:5000/${resource}`,
      body: body,
      json: true
    });
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

    if (res.headers['x-ratelimit-remaining'] < 10) {
      var delayTime = res.headers['x-ratelimit-reset'] * 1000 -
        (new Date(res.headers.expires).getTime());
      console.log('Pause during ' + delayTime);
      yield delay(delayTime);
      console.log('Pause end.');
    }

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

redis.get('import-events-next-page', (err, reply) => {
  if (err) console.log(err);

  fetchPage(reply || initUrl);
});
