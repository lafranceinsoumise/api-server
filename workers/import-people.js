'use strict';

const request = require('request-promise');
const co = require('co');
const yn = require('yn');
const winston = require('winston');

const api = require('./lib/api');
const nb = require('./lib/nation-builder');
const utils = require('./lib/utils');

const NBAPIKey = process.env.NB_API_KEY_2;
const NBNationSlug = process.env.NB_SLUG;
const MailTrainKey = process.env.MAILTRAIN_KEY;
const DisableMailTrain = !!yn(process.env.DISABLE_MAILTRAIN);
const APIKey = process.env.API_KEY;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

winston.configure({
  level: LOG_LEVEL,
  transports: [
    new (winston.transports.Console)()
  ]
});


const whiteList = [
  'créateur groupe d\'appui',
  'convention : cars',
  'convention : inscrit',
  'agir groupe d\'appui',
  'groupe d\'appuis certifié'
];


const importPeople = co.wrap(function *(forever = true) {
  do {
    winston.profile('import_people');

    winston.info('Starting new importing cycle');
    let fetchNextPage = nb.fetchAll(NBNationSlug, 'people', {NBAPIKey});
    while (fetchNextPage !== null) {
      let results;
      [results, fetchNextPage] = yield fetchNextPage();
      if (results) {
        for (let i = 0; i < results.length; i += 10) {
          yield results.slice(i, i + 10).map(updatePerson);
        }

        winston.debug('Handled page');
      }
    }
    winston.profile('import_people');
  } while (forever);
});


const updatePerson = co.wrap(function *(nbPerson) {
  if (!nbPerson.email) return;

  let person = yield updatePersonInAPI(nbPerson);

  let inscriptions = [];
  if (person && person.events && person.events.length > 0) {
    inscriptions.push('evenements');
  }
  else {
    inscriptions.push('sans_evenements');
  }
  if (person && person.groups && person.groups.length > 0) {
    inscriptions.push('groupe_appui');
  }
  else {
    inscriptions.push('sans_groupe_appui');
  }

  yield updatePersonInMailTrain(nbPerson, inscriptions.join(','));
});


const updatePersonInAPI = co.wrap(function*(nbPerson) {

  let props = {
    first_name: nbPerson.first_name,
    last_name: nbPerson.last_name,
    email: nbPerson.email,
    email_opt_in: nbPerson.email_opt_in,
    id: nbPerson.id,
    tags: nbPerson.tags
  };
  if (nbPerson && nbPerson.primary_address) {
    props.location = {
      address: nbPerson.primary_address.address1 + ', ' + nbPerson.primary_address.zip + ' ' + nbPerson.primary_address.city,
      address1: nbPerson.primary_address.address1,
      address2: nbPerson.primary_address.address2,
      city: nbPerson.primary_address.city,
      country_code: nbPerson.primary_address.country_code,
      zip: nbPerson.primary_address.zip,
      state: nbPerson.primary_address.state
    };
  }

  let person;
  // Does the person already exist in the API ?
  try {
    person = yield api.get_resource({resource:'people', id: nbPerson.id, APIKey: APIKey});
  } catch (err) {
    person = null;
    if (err.statusCode !== 404) {
      winston.error(`Failed fetching person ${nbPerson.id}`, {nbId: nbPerson.id, message: err.message});
      return null;
    }
  }

  if (person === null) {
    // If the person did not exist, insert it
    try {
      yield api.post_resource('people', props, {APIKey});
    } catch (err) {
      winston.error(`Error while creating ${nbPerson.email}:`, err.message);
    }
  } else {
    // If she did exist, patch it... but only if there's a change!
    if (utils.anyPropChanged(person, props)) {
      winston.debug(`Patching people/${person._id}`);
      try {
        yield api.patch_resource('people', person, props, APIKey);
      } catch (err) {
        winston.error(`Error while patching ${nbPerson.email}`, {nbId: nbPerson.id, person, message: err.message});
      }
    } else {
      winston.debug(`Nothing changed with people/${person._id}`);
    }
  }

  return person;
});


const updatePersonInMailTrain = co.wrap(function*(nbPerson, inscriptions) {
  // Update mailtrain
  if (!DisableMailTrain) {
    let action = nbPerson.email_opt_in === true ? 'subscribe' : 'unsubscribe';
    let tags = nbPerson.tags.filter(tag => (whiteList.indexOf(tag) !== -1));
    let zipcode = (nbPerson.primary_address &&
      nbPerson.primary_address.zip) || null;

    try {
      yield request.post({
        url: `https://newsletter.jlm2017.fr/api/${action}/SyWda9pi?access_token=${MailTrainKey}`,
        body: {
          EMAIL: nbPerson.email,
          MERGE_TAGS: tags,
          MERGE_ZIPCODE: zipcode,
          MERGE_INSCRIPTIONS: inscriptions
        },
        json: true
      });
    } catch (err) {
      winston.error(`Error updating ${nbPerson.email} on Mailtrain`, err.message);
    }
  }
});

importPeople();
