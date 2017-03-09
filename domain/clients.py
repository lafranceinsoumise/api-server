from eve.auth import TokenAuth


def get_api_key():
    import os
    return os.environ['API_KEY']

api_key = get_api_key()


class MyBasicAuth(TokenAuth):
    def check_auth(self, token, allowed_roles, resource, method):
        return token == api_key

allow_unknown = True
item_title = 'client'
resource_methods = ['GET', 'POST']
item_methods = ['GET', 'PUT', 'PATCH', 'DELETE']
cache_control = "max-age=60, private"
additional_lookup = {
    'field': 'id',
    'url': 'regex("[a-z0-9_-]+")',
}

mongo_indexes = {
    'id': ([('id', 1)], {'background': True})
}

schema = {
    'id': {
        'type': 'string',
        'unique': True
    },
    'secret': {
        'type': 'string',
    },
    'name': {
        'type': 'string',
    },
    'email': {
        'type': 'string',
    },
    'redirect_uris': {
        'type': 'list',
        'schema': {
            'type': 'string'
        }
    },
    'scopes': {
        'type': 'list',
        'schema': {
            'type': 'string',
        }
    },
    'is_trusted': {
        'type': 'boolean',
    }
}

authentication = MyBasicAuth
