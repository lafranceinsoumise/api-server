from eve.auth import TokenAuth


class MyBasicAuth(TokenAuth):
    def check_auth(self, token, allowed_roles, resource, method):
        return token == 'Fae9Shohphe0eiro0voh7shiemohxomaimahvai3eejood5oaxah6uakeep3eeva'

allow_unknown = True
resource_methods = ['GET', 'POST']
item_methods = ['GET', 'PUT']
public_methods = ['GET']
public_item_methods = ['GET']
cache_expires = 60
additional_lookup = {'field': 'id'}
pagination = False
datasource = {
    'filter': {
        'published': True
    }
}
mongo_indexes = {
    'id': ([('id', 1)], {'background': True}),
    'published': ([('published', 1)], {'background': True}),
    'startTime': ([('startTime', 1)], {'background': True}),
    'agenda': ([('agenda', 1)], {'background': True}),
    'coordinates': ([('coordinates', 1)], {'background': True}),
}
schema = {
    'id': {
        'type': 'integer',
        'unique': True
    },
    'name': {
        'type': 'string',
        'required': True
    },
    'description': {
        'type': 'string'
    },
    'path': {
        'type': 'string',
        'required': True,
        'unique': True
    },
    'tags': {
        'type': 'list',
        'schema': {
            'type': 'string'
        }
    },
    'startTime': {
        'type': 'datetime',
        'required': True
    },
    'endTime': {
        'type': 'datetime',
        'required': True
    },
    'agenda': {
        'type': 'string',
        'required': True
    },
    'coordinates': {
        'type': 'point'
    },
    'contact': {
        'type': 'dict',
        'schema': {
            'name': {
                'type': 'string'
            },
            'email': {
                'type': 'string'
            },
            'phone': {
                'type': 'string'
            }
        }
    },
    'location': {
        'type': 'dict',
        'schema': {
            'name': {
                'type': 'string'
            },
            'address': {
                'type': 'string'
            }
        }
    },
    'participants': {
        'type': 'integer'
    }
}
authentication = MyBasicAuth
