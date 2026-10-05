"""Illustrative master boundary; importing/running this file performs no HTTP calls.

The master must implement the protocol using its existing durable store and fence.
This file supplies no database, worker, polling loop, retry or exactly-once guarantee.
The master injects the API key; config.example.json is NOT read automatically.
Run from an integration that has the kit root on sys.path (Python 3.10+).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from stella_polza import (
    Catalog, DownloadedResult, JobStatus, PolzaClient, PreparedRequest,
    SubmitRejected, SubmitUnknown,
)


@dataclass(frozen=True)
class MasterAuthorization:
    """Master-issued data, not a substitute for authentication or durable state."""
    job_id: str
    attempt_id: str
    correlation_id: str
    fence: str = field(repr=False)
    paid_submit_authorized: bool = False


class MasterSubmissionBoundary(Protocol):
    def claim_submission(self, authorization: MasterAuthorization,
                         input_identity: dict) -> bool:
        """Atomically validate permission, photoRevision and current fence, bind
        job/attempt to input hashes + recipe version, and commit reserved→dispatching.
        Return True only for the winning first claim. A duplicate, expired fence,
        stale photo, unknown or already dispatching attempt MUST return False.
        Persist before returning; a process-local flag is insufficient.
        """
        ...

    def record_receipt(self, authorization: MasterAuthorization,
                       receipt: JobStatus) -> None:
        """Durably persist provider ID/status for this fenced attempt before ACK."""
        ...

    def record_unknown(self, authorization: MasterAuthorization,
                       error: SubmitUnknown) -> None:
        """Persist sanitized code and optional provider_id; never reopen for POST."""
        ...

    def record_rejected(self, authorization: MasterAuthorization,
                        error: SubmitRejected) -> None:
        """Persist explicit rejection; another paid attempt needs new authorization."""
        ...


def prepare(catalog: Catalog, genre_id: str, variant: str,
            private_photo_path: Path) -> PreparedRequest:
    """Offline only. Reuse Catalog(kit_root) after its startup validation."""
    return catalog.prepare(genre_id, variant, private_photo_path)


def submit(client: PolzaClient, prepared: PreparedRequest,
           authorization: MasterAuthorization,
           master: MasterSubmissionBoundary) -> JobStatus:
    """One paid POST after the master's durable claim, never an automatic retry.

    Construct client with enabled=True only after explicit master authorization.
    A crash after claim or POST, or a failed receipt write, leaves dispatching/unknown
    in master storage. Recovery reconciles that attempt; it MUST NOT call submit again.
    The provider's user field is correlation only, not a billing idempotency key.
    """
    if authorization.paid_submit_authorized is not True or client.enabled is not True:
        raise PermissionError("Explicit master authorization and enabled client required")
    if not all((authorization.job_id, authorization.attempt_id, authorization.fence)):
        raise ValueError("Master job, attempt and durable fence required")
    # Validate correlation before consuming the durable claim. Never log this payload.
    prepared.to_payload(authorization.correlation_id)
    if not master.claim_submission(authorization, prepared.as_dict()):
        raise PermissionError("Master denied durable submission claim")
    try:
        receipt = client.submit_once(prepared, authorization.correlation_id)
    except SubmitUnknown as error:
        master.record_unknown(authorization, error)
        raise
    except SubmitRejected as error:
        master.record_rejected(authorization, error)
        raise
    master.record_receipt(authorization, receipt)
    return receipt


def status(client: PolzaClient, persisted_provider_id: str) -> JobStatus:
    """One GET. Master owns scheduling, deadlines and durable status updates."""
    return client.get_status(persisted_provider_id)


def download(client: PolzaClient, completed_status: JobStatus,
             new_master_owned_path: Path) -> DownloadedResult:
    """One download; parent directory must exist and destination must not exist.

    Match suffix to actual PNG/JPEG/WebP. Master checks the current job/attempt/
    photoRevision fence before publishing assetRef, even after a successful download.
    Do not expose private paths or provider signed URLs on the visitor result page.
    """
    return client.download_result(completed_status, new_master_owned_path)


# Deliberately no __main__ operation, environment reads or example paid invocation.
