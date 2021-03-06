allow_unknown = True
resource_methods = ['GET']
item_methods = ['GET']
cache_control = "max-age=60"
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
            },
            'address1': {
                'type': 'string',
                'nullable': True,
            },
            'address2': {
                'type': 'string',
                'nullable': True,
            },
            'city': {
                'type': 'string',
                'nullable': True,
            },
            'country_code': {
                'type': 'string',
                'nullable': True,
            },
            'zip': {
                'type': 'string',
                'nullable': True,
            },
            'state': {
                'type': 'string',
                'nullable': True,
            },
        }
    },
    'participants': {
        'type': 'integer'
    }
}
