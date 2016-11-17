from logging import getLogger, StreamHandler
import os
import yaml
import types
import imp

# Please note that MONGO_HOST and MONGO_PORT could very well be left
# out as they already default to a bare bones local 'mongod' instance.
MONGO_HOST = 'localhost'
MONGO_PORT = 27017
MONGO_DBNAME = 'apitest'

# Enable reads (GET), inserts (POST) and DELETE for resources/collections
# (if you omit this line, the API will default to ['GET'] and provide
# read-only access to the endpoint).
RESOURCE_METHODS = ['GET', 'POST', 'DELETE']

# Enable reads (GET), edits (PATCH), replacements (PUT) and deletes of
# individual items  (defaults to read-only item access).
ITEM_METHODS = ['GET', 'PATCH', 'PUT', 'DELETE']

DEBUG = os.getenv('DEBUG', False);

log = getLogger('redado')
log.addHandler(StreamHandler())


def load_py_file(filename):
    resource = os.path.split(os.path.splitext(filename)[0])[1]
    d = imp.load_source(resource, filename)
    definition = {}
    for key in dir(d):
        if '__' not in key:
            definition[key] = d.__dict__[key]
    log.warning(" * Load domain {}".format(resource))
    return resource, definition


def load_yaml_file(filename):
    with open(filename) as yaml_file:
        try:
            resource = os.path.split(os.path.splitext(filename)[0])[1]
            log.warning(" * Load domain {}".format(resource))
            definition = yaml.load(yaml_file)
            if 'mongo_indexes' in definition:
                for index_name, index in definition['mongo_indexes'].items():
                    fields = definition['mongo_indexes'][index_name]['fields']
                    for i, pair in enumerate(fields):
                        fields[i] = (pair[0], pair[1])
                    if 'options' in definition['mongo_indexes'][index_name]:
                        definition['mongo_indexes'][index_name] = (
                            fields,
                            definition['mongo_indexes'][index_name]['options']
                        )
                    else:
                        definition['mongo_indexes'][index_name] = fields
            return resource, definition
        except (UnicodeDecodeError, yaml.constructor.ConstructorError, yaml.parser.ParserError, yaml.scanner.ScannerError):
            log.error("Invalid syntax in YAML file {}".format(yaml_file_path))


def iter_domain():
    dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '../../project/domain')
    assert os.path.exists(dir), "Directory doesn't exist: {}".format(dir)
    for sub_dir, dirs_name, filenames in os.walk(dir):
        for dir_name in dirs_name[:]:
            if dir_name.startswith('.'):
                dirs_name.remove(dir_name)
        for filename in filenames:
            if filename.endswith(".yaml"):
                yaml_file_path = os.path.join(sub_dir, filename)
                yield load_yaml_file(yaml_file_path)
            if filename.endswith(".py"):
                py_file_path = os.path.join(sub_dir, filename)
                yield load_py_file(py_file_path)


DOMAIN = {}

for domain, definition in iter_domain():
    DOMAIN[domain] = definition
