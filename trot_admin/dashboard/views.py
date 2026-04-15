import csv
import io
from datetime import datetime

from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.http import require_POST

from .firebase_client import (
    get_collection, get_document, set_document,
    delete_document, add_document, get_stats,
)
from . import platform_config as cfg

# ── Constants (kept here for form rendering) ──────────────────────────────────
ROLE_CHOICES   = ["institute", "sponsor", "household", "student"]
STATUS_CHOICES = ["active", "redeemed", "cancelled"]
UNIT_TYPES     = ["FTR", "SU"]
COURSES = [
    "Engineering", "Medical", "Management", "Law",
    "IT Diplomas", "Healthcare Technician", "Hospitality",
    "Aviation", "Arts & Economics", "Vocational Certificates",
]

def _ts_str(doc: dict, field: str) -> str:
    """Convert Firestore timestamp to readable string (safe)."""
    v = doc.get(field)
    if v is None:
        return "—"
    try:
        if hasattr(v, "isoformat"):
            return v.strftime("%d %b %Y %H:%M")
        return str(v)
    except Exception:
        return str(v)


def _enrich(docs: list[dict], date_fields=("createdAt",)) -> list[dict]:
    for d in docs:
        for f in date_fields:
            d[f"{f}_str"] = _ts_str(d, f)
    return docs


# ── Overview ──────────────────────────────────────────────────────────────────

@login_required
def index(request):
    try:
        stats = get_stats()
        recent_users = get_collection(cfg.COL_USERS, order_by="createdAt", limit=5)
        recent_issuances = get_collection(cfg.COL_ISSUANCES, order_by="createdAt", limit=5)
        _enrich(recent_users)
        _enrich(recent_issuances)
    except Exception as e:
        messages.error(request, f"Firestore error: {e}")
        stats = {}
        recent_users = []
        recent_issuances = []

    return render(request, "dashboard/index.html", {
        "stats": stats,
        "recent_users": recent_users,
        "recent_issuances": recent_issuances,
    })


# ── Users ─────────────────────────────────────────────────────────────────────

@login_required
def users_list(request):
    search = request.GET.get("q", "").strip().lower()
    role_filter = request.GET.get("role", "")

    try:
        docs = get_collection(cfg.COL_USERS, order_by="createdAt")
    except Exception as e:
        messages.error(request, f"Firestore error: {e}")
        docs = []

    # Client-side filter (Firestore free tier has no full-text search)
    if search:
        docs = [d for d in docs if
                search in d.get("name", "").lower() or
                search in d.get("email", "").lower() or
                search in d.get("mobile", "").lower()]
    if role_filter:
        docs = [d for d in docs if d.get("role") == role_filter]

    _enrich(docs)

    return render(request, "dashboard/users_list.html", {
        "users": docs,
        "search": search,
        "role_filter": role_filter,
        "role_choices": ROLE_CHOICES,
        "total": len(docs),
    })


@login_required
def user_detail(request, uid):
    doc = get_document(cfg.COL_USERS, uid)
    if doc is None:
        messages.error(request, "User not found.")
        return redirect("users_list")

    if request.method == "POST":
        data = {
            "name": request.POST.get("name", doc.get("name", "")),
            "email": request.POST.get("email", doc.get("email", "")),
            "mobile": request.POST.get("mobile", doc.get("mobile", "")),
            "role": request.POST.get("role", doc.get("role", "")),
        }
        try:
            set_document(cfg.COL_USERS, uid, data)
            messages.success(request, "User updated successfully.")
            return redirect("user_detail", uid=uid)
        except Exception as e:
            messages.error(request, f"Save failed: {e}")

    doc["createdAt_str"] = _ts_str(doc, "createdAt")
    role_data = doc.get("roleData", {})
    return render(request, "dashboard/user_detail.html", {
        "user": doc,
        "role_data": role_data,
        "role_choices": ROLE_CHOICES,
    })


@login_required
@require_POST
def user_delete(request, uid):
    try:
        delete_document(cfg.COL_USERS, uid)
        messages.success(request, f"User {uid} deleted.")
    except Exception as e:
        messages.error(request, f"Delete failed: {e}")
    return redirect("users_list")


# ── Issuances ─────────────────────────────────────────────────────────────────

@login_required
def issuances_list(request):
    search = request.GET.get("q", "").strip().lower()
    unit_filter = request.GET.get("unit", "")
    status_filter = request.GET.get("status", "")

    try:
        docs = get_collection(cfg.COL_ISSUANCES, order_by="createdAt")
    except Exception as e:
        messages.error(request, f"Firestore error: {e}")
        docs = []

    if search:
        docs = [d for d in docs if
                search in d.get("instituteName", "").lower() or
                search in d.get("course", "").lower()]
    if unit_filter:
        docs = [d for d in docs if d.get("unitType") == unit_filter]
    if status_filter:
        docs = [d for d in docs if d.get("status") == status_filter]

    _enrich(docs)

    return render(request, "dashboard/issuances_list.html", {
        "issuances": docs,
        "search": search,
        "unit_filter": unit_filter,
        "status_filter": status_filter,
        "unit_types": UNIT_TYPES,
        "status_choices": STATUS_CHOICES,
        "total": len(docs),
    })


@login_required
def issuance_detail(request, iid):
    doc = get_document(cfg.COL_ISSUANCES, iid)
    if doc is None:
        messages.error(request, "Issuance not found.")
        return redirect("issuances_list")

    if request.method == "POST":
        data = {
            "instituteName": request.POST.get("instituteName", doc.get("instituteName", "")),
            "unitType": request.POST.get("unitType", doc.get("unitType", "")),
            "course": request.POST.get("course", doc.get("course", "")),
            "quantity": int(request.POST.get("quantity", doc.get("quantity", 0))),
            "lockedFee": int(request.POST.get("lockedFee", doc.get("lockedFee", 0))),
            "status": request.POST.get("status", doc.get("status", "active")),
        }
        try:
            set_document(cfg.COL_ISSUANCES, iid, data)
            messages.success(request, "Issuance updated.")
            return redirect("issuance_detail", iid=iid)
        except Exception as e:
            messages.error(request, f"Save failed: {e}")

    doc["createdAt_str"] = _ts_str(doc, "createdAt")
    return render(request, "dashboard/issuance_detail.html", {
        "issuance": doc,
        "unit_types": UNIT_TYPES,
        "courses": COURSES,
        "status_choices": STATUS_CHOICES,
    })


@login_required
@require_POST
def issuance_delete(request, iid):
    try:
        delete_document(cfg.COL_ISSUANCES, iid)
        messages.success(request, f"Issuance {iid} deleted.")
    except Exception as e:
        messages.error(request, f"Delete failed: {e}")
    return redirect("issuances_list")


# ── Bulk Actions ──────────────────────────────────────────────────────────────

@login_required
@require_POST
def bulk_action(request):
    action = request.POST.get("action")
    collection = request.POST.get("collection")  # "users" or "issuances"
    ids = request.POST.getlist("selected_ids")

    if not ids:
        messages.warning(request, "No items selected.")
        return redirect(f"{collection}_list")

    if action == "delete":
        for doc_id in ids:
            try:
                delete_document(collection, doc_id)
            except Exception as e:
                messages.error(request, f"Failed to delete {doc_id}: {e}")
        messages.success(request, f"Deleted {len(ids)} record(s).")
        return redirect(f"{collection}_list")

    if action == "export":
        # Export selected rows to CSV
        rows = [get_document(collection, i) for i in ids]
        rows = [r for r in rows if r]
        return _export_csv(rows, filename=f"{collection}_export.csv")

    messages.error(request, "Unknown action.")
    return redirect(f"{collection}_list")


# ── Export / Import ───────────────────────────────────────────────────────────

@login_required
def export_csv(request):
    collection = request.GET.get("col", "users")
    try:
        rows = get_collection(collection, order_by="createdAt")
    except Exception as e:
        messages.error(request, f"Export failed: {e}")
        return redirect("index")
    return _export_csv(rows, filename=f"{collection}_all.csv")


def _export_csv(rows: list[dict], filename="export.csv") -> HttpResponse:
    if not rows:
        return HttpResponse("No data.", content_type="text/plain")

    # Flatten: drop nested dicts (roleData etc.) for CSV
    flat_rows = []
    for r in rows:
        flat = {}
        for k, v in r.items():
            if isinstance(v, dict):
                for sk, sv in v.items():
                    flat[f"{k}.{sk}"] = sv
            elif hasattr(v, "isoformat"):
                flat[k] = v.strftime("%Y-%m-%d %H:%M:%S")
            else:
                flat[k] = v
        flat_rows.append(flat)

    fieldnames = list(flat_rows[0].keys()) if flat_rows else []
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(flat_rows)

    response = HttpResponse(buf.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@login_required
def import_csv(request):
    if request.method == "POST":
        collection = request.POST.get("collection", "users")
        csv_file = request.FILES.get("csv_file")
        if not csv_file:
            messages.error(request, "No file uploaded.")
            return redirect("import_csv")

        try:
            decoded = csv_file.read().decode("utf-8")
            reader = csv.DictReader(io.StringIO(decoded))
            count = 0
            for row in reader:
                # Remove empty strings
                clean = {k: v for k, v in row.items() if v != ""}
                # Add server timestamp marker
                clean["importedAt"] = datetime.utcnow().isoformat()
                add_document(collection, clean)
                count += 1
            messages.success(request, f"Imported {count} record(s) into '{collection}'.")
        except Exception as e:
            messages.error(request, f"Import failed: {e}")

        return redirect(f"{collection}_list")

    return render(request, "dashboard/import_csv.html", {
        "collections": ["users", "issuances"],
    })
