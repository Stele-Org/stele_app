"""Polza media contract, using HTTPX transport and Pillow image validation.

No queue, persistence, retry or billing-idempotency claim. ``user`` is correlation only.
POST ambiguity must be reconciled by the master's durable workflow, never resubmitted here.
"""
from __future__ import annotations

import base64
from contextlib import closing, suppress
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
import hashlib
from io import BytesIO
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import tempfile
from urllib.parse import quote, urlsplit
import warnings

import httpx
from PIL import Image

MEDIA_URL = "https://polza.ai/api/v1/media"
MODEL = "bytedance/seedream-5-lite"
INPUT_LIMIT = 10 * 1024 * 1024
DOWNLOAD_LIMIT = 25 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_SIDE = 16384
TIMEOUT = httpx.Timeout(55.0, connect=10.0)
FORMATS = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}
STATES = frozenset({"pending", "queued", "processing", "running", "completed", "failed", "cancelled", "canceled"})


class AdapterError(Exception):
    """Codes are local constants; raw provider bodies/URLs are never attached."""
    def __init__(self, code: str, http_status: int | None = None):
        super().__init__(code)
        self.code = code
        self.http_status = http_status


class ValidationError(AdapterError):
    pass


class Disabled(AdapterError):
    pass


class SubmitUnknown(AdapterError):
    """Provider may have accepted the paid POST; do not retry automatically."""
    def __init__(self, code: str, http_status: int | None = None, provider_id: str | None = None):
        super().__init__(code, http_status)
        self.provider_id = provider_id


class SubmitRejected(AdapterError):
    pass


class StatusError(AdapterError):
    pass


class DownloadError(AdapterError):
    pass


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _image_info(data: bytes, limit: int) -> tuple[str, int, int]:
    if not data or len(data) > limit:
        raise ValidationError("IMAGE_SIZE_LIMIT")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                fmt = image.format
                width, height = image.size
                if (fmt not in FORMATS or width < 1 or height < 1
                        or max(width, height) > MAX_SIDE or width * height > MAX_PIXELS
                        or getattr(image, "n_frames", 1) != 1):
                    raise ValidationError("IMAGE_UNSUPPORTED")
                image.verify()
            # verify checks container integrity; load actually exercises the decoder.
            with Image.open(BytesIO(data)) as image:
                image.load()
            return fmt, width, height
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("IMAGE_DECODE_FAILED") from None


def _read_limited(path: Path, limit: int) -> bytes:
    try:
        with path.open("rb") as stream:
            data = stream.read(limit + 1)
    except OSError:
        raise ValidationError("INPUT_UNREADABLE") from None
    if not data or len(data) > limit:
        raise ValidationError("INPUT_SIZE_LIMIT")
    return data


@dataclass(frozen=True)
class PreparedRequest:
    genre_id: str
    variant: str
    prompt: str = field(repr=False)
    prompt_sha256: str
    photo_sha256: str
    cleanplate_sha256: str
    photo_path: Path = field(repr=False)
    cleanplate_path: Path = field(repr=False)
    _photo: bytes = field(repr=False)
    _cleanplate: bytes = field(repr=False)
    _photo_mime: str = field(repr=False)

    def as_dict(self) -> dict:
        return {"genre_id": self.genre_id, "variant": self.variant, "model": MODEL,
                "quality": "basic", "aspect_ratio": "16:9", "input_order": ["visitor_photo", "cleanplate"],
                "prompt_sha256": self.prompt_sha256, "prompt_characters": len(self.prompt),
                "photo_sha256": self.photo_sha256, "cleanplate_sha256": self.cleanplate_sha256}

    def to_payload(self, correlation_id: str) -> dict:
        if not isinstance(correlation_id, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", correlation_id):
            raise ValidationError("CORRELATION_ID_INVALID")
        # Byte snapshots, not mutable source paths; never log this return value.
        return {"model": MODEL, "async": True, "user": correlation_id,
                "input": {"prompt": self.prompt, "quality": "basic", "aspect_ratio": "16:9",
                          "images": [
                              {"type": "base64", "data": "data:" + self._photo_mime + ";base64," + base64.b64encode(self._photo).decode("ascii")},
                              {"type": "base64", "data": "data:image/png;base64," + base64.b64encode(self._cleanplate).decode("ascii")},
                          ]}}


class Catalog:
    """Validate exactly twenty pinned PNGs once; prepare immutable input snapshots."""
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        try:
            recipes = json.loads((self.root / "prompts/recipes.json").read_text(encoding="utf-8-sig"))
            manifest = json.loads((self.root / "assets/manifest.json").read_text(encoding="utf-8-sig"))
            rows = recipes["recipes"]
            assets = manifest["assets"]
            if len(rows) != 10 or len(assets) != 20:
                raise ValidationError("CATALOG_COUNT_INVALID")
            if recipes.get("inputOrder") != {"photo": 1, "cleanplate": 2}:
                raise ValidationError("CATALOG_INPUT_ORDER_INVALID")
            self._recipes = {row["id"]: row for row in rows}
            if len(self._recipes) != 10:
                raise ValidationError("CATALOG_DUPLICATE_GENRE")
            self._prefix = recipes["prefix"]
            self._plates = {}
            plate_root = (self.root / "assets/clean-plates").resolve()
            for row in assets:
                key = (row["genre"], {"M": "male", "F": "female"}[row["variant"]])
                output = row["output"]
                name = output["file"]
                if not isinstance(name, str) or Path(name).name != name or "/" in name or "\\" in name:
                    raise ValidationError("CATALOG_PATH_INVALID")
                path = (plate_root / name).resolve()
                if not path.is_relative_to(plate_root) or path.suffix.lower() != ".png":
                    raise ValidationError("CATALOG_PATH_INVALID")
                data = _read_limited(path, INPUT_LIMIT)
                digest = _sha(data)
                fmt, width, height = _image_info(data, INPUT_LIMIT)
                if (fmt != "PNG" or digest != output["sha256"].lower()
                        or len(data) != output["bytes"] or width != output["width"] or height != output["height"]):
                    raise ValidationError("CATALOG_ASSET_MISMATCH")
                if key in self._plates or self._recipes[key[0]]["png"][key[1]] != name:
                    raise ValidationError("CATALOG_MAPPING_INVALID")
                self._plates[key] = (path, data, digest)
            if set(self._plates) != {(genre, variant) for genre in self._recipes for variant in ("male", "female")}:
                raise ValidationError("CATALOG_MAPPING_INVALID")
            for genre in self._recipes:
                for variant in ("male", "female"):
                    self._prompt(genre, variant)
        except ValidationError:
            raise
        except (OSError, ValueError, TypeError, KeyError, AttributeError):
            raise ValidationError("CATALOG_INVALID") from None

    @property
    def genre_ids(self) -> tuple[str, ...]:
        return tuple(self._recipes)

    def _prompt(self, genre: str, variant: str) -> str:
        row = self._recipes[genre]
        parts = (self._prefix, row["common"], row[variant])
        if any(not isinstance(p, str) or not p.strip() for p in parts):
            raise ValidationError("PROMPT_INVALID")
        prompt = "\n\n".join(parts)
        if len(prompt) > 2996:
            raise ValidationError("PROMPT_TOO_LONG")
        return prompt

    def prepare(self, genre_id: str, variant: str, photo_path: str | Path) -> PreparedRequest:
        variant = {"M": "male", "F": "female", "male": "male", "female": "female"}.get(variant)
        if variant is None or genre_id not in self._recipes:
            raise ValidationError("SELECTION_INVALID")
        path = Path(photo_path).resolve()
        photo = _read_limited(path, INPUT_LIMIT)
        fmt, _, _ = _image_info(photo, INPUT_LIMIT)
        plate_path, plate, digest = self._plates[(genre_id, variant)]
        prompt = self._prompt(genre_id, variant)
        return PreparedRequest(genre_id, variant, prompt, _sha(prompt.encode("utf-8")),
                               _sha(photo), digest, path, plate_path, photo, plate, FORMATS[fmt])


@dataclass(frozen=True)
class JobStatus:
    provider_id: str
    status: str
    cost_rub: Decimal | None = None
    _result_url: str | None = field(default=None, repr=False)
    error_code: str | None = None

    def as_dict(self) -> dict:
        return {"provider_id": self.provider_id, "status": self.status,
                "cost_rub": str(self.cost_rub) if self.cost_rub is not None else None,
                "error_code": self.error_code}


@dataclass(frozen=True)
class DownloadedResult:
    path: Path
    sha256: str
    bytes: int
    width: int
    height: int
    format: str

    def as_dict(self) -> dict:
        return {"path": str(self.path), "sha256": self.sha256, "bytes": self.bytes,
                "width": self.width, "height": self.height, "format": self.format}


def _provider_id(value) -> str:
    # Opaque identifier; deliberately no gen_ prefix assumption.
    if not isinstance(value, str) or not value or value in {".", ".."} or len(value) > 200 or any(ord(c) < 33 or ord(c) == 127 for c in value):
        raise ValidationError("PROVIDER_ID_INVALID")
    return value


def _status(data: dict, expected_id: str | None = None) -> JobStatus:
    if not isinstance(data, dict):
        raise ValidationError("RESPONSE_INVALID")
    ident = _provider_id(data.get("id", expected_id))
    if expected_id is not None and ident != expected_id:
        raise ValidationError("PROVIDER_ID_MISMATCH")
    state = data.get("status")
    if state not in STATES:
        raise ValidationError("STATUS_INVALID")
    cost = None
    usage = data.get("usage")
    raw_cost = usage.get("cost_rub") if isinstance(usage, dict) else None
    if raw_cost is not None and not isinstance(raw_cost, bool):
        try:
            candidate = Decimal(str(raw_cost))
            if candidate.is_finite() and candidate >= 0:
                cost = candidate
        except (InvalidOperation, ValueError):
            pass
    result = data.get("data")
    if isinstance(result, dict):
        result = result.get("url", result.get("images"))
    if isinstance(result, list):
        result = next((item if isinstance(item, str) else item.get("url") for item in result
                       if isinstance(item, str) or isinstance(item, dict) and isinstance(item.get("url"), str)), None)
    url = result if isinstance(result, str) else None
    error = data.get("error")
    error_code = error.get("code") if isinstance(error, dict) else None
    if not isinstance(error_code, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", error_code):
        error_code = None
    return JobStatus(ident, state, cost, url, error_code)


def _public_https(url: str) -> str:
    try:
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
                or parsed.password is not None or parsed.port not in (None, 443) or parsed.fragment
                or "\\" in url or any(ord(c) < 33 for c in url)):
            raise ValueError
        host = parsed.hostname
        try:
            addresses = [ipaddress.ip_address(host)]
        except ValueError:
            addresses = [ipaddress.ip_address(info[4][0]) for info in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)]
        if not addresses or any(not address.is_global for address in addresses):
            raise ValueError
        return url
    except (ValueError, OSError):
        raise DownloadError("RESULT_URL_REJECTED") from None


class PolzaClient:
    """One HTTP operation per method. Injected clients are trusted test/application dependencies."""
    def __init__(self, api_key: str, enabled: bool = False, http_client: httpx.Client | None = None,
                 download_client: httpx.Client | None = None):
        if not isinstance(api_key, str) or not api_key or not api_key.isascii() or any(c.isspace() or ord(c) < 33 for c in api_key):
            raise ValidationError("API_KEY_INVALID")
        self._key = api_key
        self.enabled = enabled is True
        self._owns_http = http_client is None
        self._owns_download = download_client is None
        self._http = http_client or httpx.Client(transport=httpx.HTTPTransport(retries=0, trust_env=False), timeout=TIMEOUT,
                                               follow_redirects=False, trust_env=False)
        self._download = download_client or httpx.Client(transport=httpx.HTTPTransport(retries=0, trust_env=False), timeout=TIMEOUT,
                                                        follow_redirects=False, trust_env=False)

    def close(self):
        if self._owns_http:
            self._http.close()
        if self._owns_download:
            self._download.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def _json(self, method: str, url: str, payload=None) -> tuple[int, dict | None]:
        request = httpx.Request(method, url, headers={"Authorization": "Bearer " + self._key, "Accept": "application/json"},
                                json=payload, extensions={"timeout": TIMEOUT.as_dict()})
        with closing(self._http.send(request, stream=True, auth=None, follow_redirects=False)) as response:
            if not 200 <= response.status_code < 300:
                return response.status_code, None
            body = bytearray()
            for chunk in response.iter_bytes(65536):
                body.extend(chunk)
                if len(body) > 1024 * 1024:
                    raise ValueError
            return response.status_code, json.loads(body)

    def submit_once(self, prepared: PreparedRequest, correlation_id: str) -> JobStatus:
        if self.enabled is not True:
            raise Disabled("PAID_SUBMIT_DISABLED")
        payload = prepared.to_payload(correlation_id)
        ident = None
        try:
            code, data = self._json("POST", MEDIA_URL, payload)
            if code in {400, 401, 402, 403, 404, 422}:
                raise SubmitRejected("SUBMIT_REJECTED", code)
            if not 200 <= code < 300:
                raise SubmitUnknown("SUBMIT_OUTCOME_UNKNOWN", code)
            if isinstance(data, dict):
                ident = _provider_id(data.get("id"))
            return _status(data)
        except (SubmitRejected, SubmitUnknown):
            raise
        except (httpx.HTTPError, ValueError, ValidationError, TypeError):
            raise SubmitUnknown("SUBMIT_OUTCOME_UNKNOWN", provider_id=ident) from None

    def get_status(self, provider_id: str) -> JobStatus:
        ident = _provider_id(provider_id)
        try:
            code, data = self._json("GET", MEDIA_URL + "/" + quote(ident, safe=""))
            if not 200 <= code < 300:
                raise StatusError("STATUS_HTTP_ERROR", code)
            return _status(data, ident)
        except StatusError:
            raise
        except (httpx.HTTPError, ValueError, ValidationError, TypeError):
            raise StatusError("STATUS_UNAVAILABLE") from None

    def download_result(self, status: JobStatus, destination: str | Path) -> DownloadedResult:
        if status.status != "completed" or not status._result_url:
            raise DownloadError("RESULT_NOT_READY")
        url = _public_https(status._result_url)
        destination = Path(destination)
        if ".." in destination.parts:
            raise DownloadError("DESTINATION_INVALID")
        destination = destination.absolute()
        if destination.exists() or destination.is_symlink() or not destination.parent.is_dir():
            raise DownloadError("DESTINATION_UNAVAILABLE")
        temp_path = None
        try:
            # Fresh Request omits any API-client headers/cookies. Never send Authorization to storage.
            request = httpx.Request("GET", url, headers={"Accept": "image/png,image/jpeg,image/webp"},
                                    extensions={"timeout": TIMEOUT.as_dict()})
            with closing(self._download.send(request, stream=True, auth=None, follow_redirects=False)) as response:
                if response.status_code != 200:
                    raise DownloadError("DOWNLOAD_HTTP_ERROR", response.status_code)
                length = response.headers.get("content-length")
                if length is not None and (not length.isdigit() or int(length) > DOWNLOAD_LIMIT):
                    raise DownloadError("RESULT_SIZE_LIMIT")
                data = bytearray()
                for chunk in response.iter_bytes(65536):
                    data.extend(chunk)
                    if len(data) > DOWNLOAD_LIMIT:
                        raise DownloadError("RESULT_SIZE_LIMIT")
            content = bytes(data)
            fmt, width, height = _image_info(content, DOWNLOAD_LIMIT)
            allowed_suffixes = {"PNG": {".png"}, "JPEG": {".jpg", ".jpeg"}, "WEBP": {".webp"}}
            if destination.suffix.lower() not in allowed_suffixes[fmt]:
                raise DownloadError("DESTINATION_FORMAT_MISMATCH")
            # Same-volume temporary + exclusive hard link: complete bytes appear atomically;
            # existing master output cannot be overwritten, including racing writers.
            fd, name = tempfile.mkstemp(prefix=".polza-", suffix=".tmp", dir=destination.parent)
            temp_path = Path(name)
            with os.fdopen(fd, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.link(temp_path, destination)
            return DownloadedResult(destination, _sha(content), len(content), width, height, fmt)
        except DownloadError:
            raise
        except ValidationError:
            raise DownloadError("RESULT_IMAGE_INVALID") from None
        except (httpx.HTTPError, OSError, ValueError):
            raise DownloadError("DOWNLOAD_FAILED") from None
        finally:
            if temp_path is not None:
                # Cleanup cannot revoke an already committed result or hide its primary error.
                with suppress(OSError):
                    temp_path.unlink(missing_ok=True)
