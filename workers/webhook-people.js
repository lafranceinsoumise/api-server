const express = require('express');
const bodyParser = require('body-parser');
const webHookKey = process.env.WEBHOOK_NB_KEY;

var updatePerson = require('./lib/people').updatePerson;

var app = express();

app.use(bodyParser.json());
app.post('/people', (req, res) => {
  if (req.body.token !== webHookKey) {
    return res.sendStatus(401);
  }

  var nbPerson = req.body.payload.person;
  if (!nbPerson) return res.sendStatus(400);

  updatePerson(nbPerson);

  return res.sendStatus(202);
});

app.listen(4000, '127.0.0.1');
