"""HTTP smoke targets must reach a service, never curl options or local files."""

from urllib.parse import urlsplit


def validate_http_url(url: str) -> None:
    try:
        parsed = urlsplit(url)
        valid = (
            not any(character.isspace() or ord(character) < 32 for character in url)
            and parsed.scheme in ("http", "https")
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
            and not parsed.fragment
            and (parsed.port is None or 0 < parsed.port <= 65535)
        )
    except ValueError:
        valid = False
    if not valid:
        raise ValueError("Smoke requires a valid HTTP(S) URL without credentials or fragments")
