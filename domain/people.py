from eve.auth import TokenAuth


class MyBasicAuth(TokenAuth):
    def check_auth(self, token, allowed_roles, resource, method):
        return token == 'admin'

allow_unknown = True
item_title = 'person'
resource_methods = ['GET', 'POST']
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
    }
}
authentication = MyBasicAuth
