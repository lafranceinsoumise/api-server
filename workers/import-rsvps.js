'use strict';

const co = require('co');
const winston = require('winston');

const api = require('./lib/api');
const nb = require('./lib/nation-builder');

const NBAPIKey = process.env.NB_API_KEY_3;
const NBNationSlug = process.env.NB_SLUG;
const APIKey = process.env.API_KEY;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

winston.configure({
  level: LOG_LEVEL,
  transports: [
    new (winston.transports.Console)()
  ]
});

const attributes_names = {
  all_events: 'events',
  all_groups: 'groups'
};

const importRSVPs = co.wrap(function*(forever = true) {

  do {
    for (let resource of ['all_events', 'all_groups']) {
      winston.profile(`import_RSVPs_${resource}`);
      winston.info(`cycle starting, ${resource}`);
      try {
        // let's first fetch all events/groups
        let items = yield fetchResource(resource);

        // handle RSVPS using ten concurrent 'threads' of execution
        // could be handled better
        for (let i = 0; i < items.length; i += 5) {
          yield items.slice(i, i + 5).map(item => updateItem(resource, item));
        }
      } catch (err) {
        winston.error(`Failed handling ${resource}`, {message: err.message});
      }
      winston.profile(`import_RSVPs_${resource}`);
    }
  } while (forever);
});

const fetchResource = co.wrap(function*(resource) {
  try {
    winston.debug(`Fetching all ${resource}`);

    let res = yield api.get_resource({resource, APIKey});

    return res._items;
  } catch (err) {
    winston.error(`Failed fetching all ${resource}`, {message: err.message});
    throw err;
  }
});

const updateItem = co.wrap(function*(resource, item) {
  winston.debug(`Updating RSVPs for ${resource}/${item}`);

  let participants = 0;

  let fetchRSVPs = nb.fetchAll(NBNationSlug, `sites/${NBNationSlug}/pages/events/${item.id}/rsvps`, {NBAPIKey});
  while (fetchRSVPs !== null) {
    let rsvps;
    [rsvps, fetchRSVPs] = yield fetchRSVPs();
    if (rsvps) {
      participants += rsvps.length;
      // now update all people referred in the RSVPS
      for (let i = 0; i < rsvps.length; i++) {
        yield updatePeople(resource, item._id, rsvps[i].person_id);
      }
    }
  }

  // patch the number of participants for the event/group
  if (item.participants !== participants) {
    try {
      yield api.patch_resource(resource, item, {participants}, APIKey);
    } catch (err) {
      winston.error(`Error patching ${resource} ${item._id}`, {message: err.message});
      // here we still try to update people
    }
  }

});

const updatePeople = co.wrap(function *(resource, eventId, personId) {
  // Get email from te person nationbuilder id
  let person;
  try {
    person = yield api.get_resource({resource: 'people', id: personId, APIKey});
  } catch (err) {
    if (err.statusCode !== 404) {
      winston.error(`Failed fetching person ${personId}`, {message: err.message});
    } else {
      winston.debug(`404 when fetching person ${personId}`);
    }
    return;
  }

  let attr = attributes_names[resource];

  let body = {};
  if ((!person[attr]) || (person[attr].indexOf(eventId) == -1)) {
    // Update only if resource is not already on the person
    body[attr] = person[attr] ? [...new Set(person[attr].concat(eventId))] : [eventId];

    try {
      yield api.patch_resource('people', person, body, APIKey);
    } catch (err) {
      winston.error(`Failed updating person ${personId} (${person._id}):`, {message: err.message});
    }
  }
});


importRSVPs();
