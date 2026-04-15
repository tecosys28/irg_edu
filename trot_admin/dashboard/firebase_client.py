import firebase_admin
from firebase_admin import credentials, firestore
from django.conf import settings
from . import platform_config as cfg

_db = None

def get_db():
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db


# ── Generic helpers ──────────────────────────────────────────────────────────

def get_collection(col: str, filters: dict = None, order_by: str = None,
                   limit: int = None) -> list[dict]:
    """Fetch all docs from a collection, with optional filter/sort/limit."""
    db = get_db()
    q = db.collection(col)
    if filters:
        for field, op, value in filters:
            q = q.where(field, op, value)
    if order_by:
        q = q.order_by(order_by, direction=firestore.Query.DESCENDING)
    if limit:
        q = q.limit(limit)
    return [{"id": d.id, **d.to_dict()} for d in q.stream()]


def get_document(col: str, doc_id: str) -> dict | None:
    db = get_db()
    doc = db.collection(col).document(doc_id).get()
    if doc.exists:
        return {"id": doc.id, **doc.to_dict()}
    return None


def set_document(col: str, doc_id: str, data: dict):
    db = get_db()
    db.collection(col).document(doc_id).set(data, merge=True)


def delete_document(col: str, doc_id: str):
    db = get_db()
    db.collection(col).document(doc_id).delete()


def add_document(col: str, data: dict) -> str:
    db = get_db()
    _, ref = db.collection(col).add(data)
    return ref.id


# ── Stats ────────────────────────────────────────────────────────────────────

def get_stats() -> dict:
    db = get_db()
    users     = list(db.collection(cfg.COL_USERS).stream())
    issuances = list(db.collection(cfg.COL_ISSUANCES).stream())

    roles = {"institute": 0, "sponsor": 0, "household": 0, "student": 0}
    for u in users:
        r = u.to_dict().get("role", "")
        if r in roles:
            roles[r] += 1

    ftr_count = sum(1 for i in issuances if i.to_dict().get("unitType") == "FTR")
    su_count  = sum(1 for i in issuances if i.to_dict().get("unitType") == "SU")

    return {
        "total_users": len(users),
        "total_issuances": len(issuances),
        "ftr_count": ftr_count,
        "su_count": su_count,
        **{f"role_{k}": v for k, v in roles.items()},
    }
