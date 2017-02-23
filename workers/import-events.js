'use strict';

const co = require('co');
const winston = require('winston');

const api = require('./lib/api');
const nb = require('./lib/nation-builder');
const utils = require('./lib/utils');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

winston.configure({
  level: LOG_LEVEL,
  transports: [
    new (winston.transports.Console)()
  ]
});

const NBAPIKey = process.env.NB_API_KEY_1;
const NBNationSlug = process.env.NB_SLUG;
const APIKey = process.env.API_KEY;

const importEvents = co.wrap(function *(forever = true) {
  do {
    winston.profile('import_events');

    winston.info('Starting new import_events cycle');
    let fetchNextPage = nb.fetchAll(NBNationSlug, `sites/${NBNationSlug}/pages/events`, {NBAPIKey});
    while (fetchNextPage !== null) {
      let results;
      [results, fetchNextPage] = yield fetchNextPage();

      if (results) {
        for (let i = 0; i < results.length; i += 10) {
          yield results.slice(i, i + 10).map(updateEvent);
        }
      }
    }

    winston.profile('import_events');
  } while (forever);
});

/**
 * Update event
 * @type {[type]}
 */
const updateEvent = co.wrap(function *(nbEvent) {
  winston.debug('Update event:' + nbEvent.id);

  // Which resource are we using on api.jlm2017.fr
  const resource = nbEvent.calendar_id === 3 ? 'all_groups' : 'all_events';

  // Construct our POST body
  const props = {
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
    props.description = nbEvent.intro;
  }

  if (nbEvent.contact.show_phone && nbEvent.contact.phone) {
    props.contact.phone = nbEvent.contact.phone;
  }

  if (nbEvent.contact.show_email && nbEvent.contact.email) {
    props.contact.email = nbEvent.contact.email;
  }

  if (nbEvent.venue && nbEvent.venue.address && nbEvent.venue.address.lng &&
    nbEvent.venue.address.lat) {
    props.coordinates = {
      type: 'Point',
      coordinates: [
        Number(nbEvent.venue.address.lng),
        Number(nbEvent.venue.address.lat)
      ]
    };
    props.location = {
      name: nbEvent.venue.name,
      address: nbEvent.venue.address.address1 + ', ' + nbEvent.venue.address.zip + ' ' + nbEvent.venue.address.city,
      address1: nbEvent.venue.address.address1,
      address2: nbEvent.venue.address.address2,
      city: nbEvent.venue.address.city,
      country_code: nbEvent.venue.address.country_code,
      zip: nbEvent.venue.address.zip,
      state: nbEvent.venue.address.state
    };
  }

  if (nbEvent.calendar_id !== 3) {
    props.startTime = new Date(nbEvent.start_time).toUTCString();
    props.endTime = new Date(nbEvent.end_time).toUTCString();
    switch (nbEvent.calendar_id) {
    case 4:
      props.agenda = 'evenements_locaux';
      break;
    case 7:
      props.agenda = 'melenchon';
      break;
    case 15:
      props.agenda = 'reunions_circonscription';
      break;
    case 16:
      props.agenda = 'reunions_publiques';
      break;
    case 10:
      // ==> covoiturages
      return;
    case 14:
      // ==> hebergement
      return;
    default:
      // unknown calendar_id: let's log and return
      winston.info(`Event ${nbEvent.id}'s calendar_id is an unknown value (${nbEvent.calendar_id})`);
      return;
      // break;
    }
  }

  let event = null;
  try {
    // Does the event already exist in the API ?
    event = yield api.get_resource({resource, id: nbEvent.id, APIKey});
  } catch (err) {
    if (err.statusCode !== 404) {
      winston.error(`Failed fetching ${resource}/${nbEvent.id}`, {nbId: nbEvent.id, message: err.message});
      return;
    }
  }

  if (event === null) {
    // the event did not exist in the API before
    // we need to push it
    try {
      yield api.post_resource(resource, props, {APIKey});
    } catch (err) {
      if (err.statusCode == 422) {
        yield checkValidationError(resource, props, err);
      } else {
        winston.error(`Error while creating ${resource} ${nbEvent.id}:`, err.message);
      }
    }
  } else {
    //the event did exist, we need to patch it, if it changed
    if (utils.anyPropChanged(event, props)) {
      winston.debug(`Patching ${resource}/${event._id}`);
      try {
        yield api.patch_resource(resource, event, props, APIKey);
      } catch (err) {
        winston.error(`Error while patching ${resource}/${event._id}`, {
          nbId: nbEvent.id,
          event,
          message: err.message
        });
      }
    } else {
      winston.debug(`Nothing changed with people/${event._id}`);
    }
  }
});


const checkValidationError = co.wrap(function*(resource, duplicate, originalError) {
  let response;
  try {
    response = yield api.get_resource({resource, where: `{"path":"${duplicate.path}"}`, APIKey});
  } catch (err) {
    winston.error(
      'import-events - unknown error while checking duplicate',
      {resource, duplicate, originalError: api.logError(originalError), error: api.logError(err)}
    );
    return;
  }
  if (response['_items'].length != 1) {
    winston.error(
      'import-events - other validation error',
      {resource, id: duplicate.id, path: duplicate.path, error: api.logError(originalError)}
    );
    return;
  }

  let existing = response._items[0];
  let differences = utils.getDifferentProps(existing, duplicate);
  delete differences.id;

  if (response.id === duplicate.id) {
    winston.warn(
      'import-events - potential corner case',
      {duplicate: duplicate, existing: existing.id, path: duplicate.path, _id: existing._id, message: originalError.message}
    );
  } else {
    if (Object.keys(differences).length === 0) {
      winston.debug('import-events - exact duplicate', {duplicate: duplicate.id, existing: existing.id, _id: existing._id});
    } else {
      winston.info('import-events - partial duplicate',
        {duplicate: duplicate.id, existing: existing.id, _id: existing._id, differences});
    }
  }

});


importEvents();