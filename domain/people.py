from eve.auth import TokenAuth


class MyBasicAuth(TokenAuth):
    def check_auth(self, token, allowed_roles, resource, method):
        return token == 'ethaelahz5Rei4seekiiGh1aipias6xohmohmaej9oodee6chahGh8ua3OorieCh'

allow_unknown = True
item_title = 'person'
resource_methods = ['GET', 'POST']
item_methods = ['GET', 'PUT', 'PATCH']
additional_lookup = {'field': 'id'}
mongo_indexes = {
    'id': ([('id', 1)], {'background': True})
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
    'support_level': {
        'type': 'integer'
    },
    'is_volunteer': {
        'type': 'boolean'
    },
    'syndicat': {
        'type': 'string'
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
                'resource': 'events',
                'field': '_id'
            }
        }
    },
    'groups': {
        'type': 'list',
        'schema': {
            'type': 'objectid',
            'data_relation': {
                'resource': 'groups',
                'field': '_id'
            }
        }
    }
}
authentication = MyBasicAuth
