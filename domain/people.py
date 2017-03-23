from eve.auth import TokenAuth


def get_api_key():
    import os
    return os.environ['API_KEY']

api_key = get_api_key()


class MyBasicAuth(TokenAuth):
    def check_auth(self, token, allowed_roles, resource, method):
        return token == api_key

allow_unknown = True
item_title = 'person'
resource_methods = ['GET', 'POST']
item_methods = ['GET', 'PUT', 'PATCH', 'DELETE']
cache_control = "max-age=60, private"
additional_lookup = {'field': 'id'}
mongo_indexes = {
    'id': ([('id', 1)], {'background': True}),
    'email': ([('email', 1)], {'background': True})
}
schema = {
    'id': {
        'type': 'integer',
        'required': True,
        'unique': True
    },
    'first_name': {
        'type': 'string',
        'maxlength': 255
    },
    'last_name': {
        'type': 'string',
        'maxlength': 255
    },
    'email': {
        'type': 'string',
        'required': True,
        'unique': True
    },
    'email_opt_in': {
        'type': 'boolean',
        'required': True
    },
    'tags': {
        'type': 'list',
        'schema': {
            'type': 'string'
        }
    },
    'events': {
        'type': 'list',
        'schema': {
            'type': 'objectid',
            'data_relation': {
                'resource': 'all_events',
                'field': '_id'
            }
        }
    },
    'groups': {
        'type': 'list',
        'schema': {
            'type': 'objectid',
            'data_relation': {
                'resource': 'all_groups',
                'field': '_id'
            }
        }
    },
    'location': {
        'type': 'dict',
        'schema': {
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
        },
    },
    'authorizations': {
        'type': 'list',
        'schema': {
            'type': 'dict',
            'schema': {
                'client': {
                    'type': 'objectid',
                    'data_relation' : {
                        'resource': 'clients',
                        'field': '_id'
                    }
                },
                'scopes': {
                    'type': 'list',
                    'schema': {
                        'type': 'string'
                    }
                }
            }
        }
    }
}
authentication = MyBasicAuth
