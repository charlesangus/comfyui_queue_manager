from .qm_db import write_query, read_single, read_query
import json


# Options manager with caching
class QM_Options:
    def __init__(self):
        # cache for options
        self.__options = {}

    def set(self, key, value=None):
        write_query(
            """
            INSERT INTO options(key, value)
            VALUES(?, ?)
            ON CONFLICT(key) DO UPDATE
              SET value = excluded.value;
        """,
            (key, json.dumps(value)),
        )
        self.__options[key] = value

    def get(self, key, default=None):
        if key in self.__options:
            return self.__options[key]

        value = read_single(
            """
                SELECT value FROM options
                WHERE key = ?
            """,
            (key,),
        )

        return_value = default if value is None else json.loads(value[0])
        self.__options[key] = return_value
        return return_value

    def get_all(self):
        options = read_query(
            """
                SELECT key, value FROM options
            """
        )

        if options is None:
            return {}

        for key, value in options:
            self.__options[key] = json.loads(value)

        return dict(self.__options)
