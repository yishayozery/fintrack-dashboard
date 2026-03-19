from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas
from auth import get_current_user, get_current_admin

router = APIRouter(prefix="/users", tags=["users"])


# ── Own profile ──────────────────────────────────────────────────────
@router.get("/me", response_model=schemas.UserProfile)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserProfile)
def update_me(
    req: schemas.UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    for field, value in req.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ── Dashboard state (save / load) ───────────────────────────────────
@router.get("/me/state", response_model=schemas.DashboardStateResponse)
def get_state(current_user: models.User = Depends(get_current_user)):
    return schemas.DashboardStateResponse(
        cat_overrides     = current_user.cat_overrides     or {},
        tx_project_map    = current_user.tx_project_map    or {},
        projects          = current_user.projects          or [],
        ins_renewal_dates = current_user.ins_renewal_dates or {},
        dismissed_issues  = current_user.dismissed_issues  or [],
        dispute_items     = current_user.dispute_items     or [],
    )


@router.put("/me/state")
def save_state(
    req: schemas.DashboardStateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if req.cat_overrides     is not None: current_user.cat_overrides     = req.cat_overrides
    if req.tx_project_map    is not None: current_user.tx_project_map    = req.tx_project_map
    if req.projects          is not None: current_user.projects          = req.projects
    if req.ins_renewal_dates is not None: current_user.ins_renewal_dates = req.ins_renewal_dates
    if req.dismissed_issues  is not None: current_user.dismissed_issues  = req.dismissed_issues
    if req.dispute_items     is not None: current_user.dispute_items     = req.dispute_items
    db.commit()
    return {"status": "saved"}


# ── Admin: list all users ────────────────────────────────────────────
@router.get("/admin/all", response_model=List[schemas.AdminUserSummary])
def list_all_users(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin),
):
    users = db.query(models.User).all()
    result = []
    for u in users:
        upload_count = db.query(models.UploadedFile).filter(models.UploadedFile.user_id == u.id).count()
        summary = schemas.AdminUserSummary(
            id                   = u.id,
            username             = u.username,
            email                = u.email,
            full_name            = u.full_name,
            city                 = u.city,
            family_status        = u.family_status,
            num_children         = u.num_children or 0,
            employment_type      = u.employment_type,
            monthly_income_range = u.monthly_income_range,
            is_active            = u.is_active,
            is_admin             = u.is_admin,
            created_at           = u.created_at,
            last_login           = u.last_login,
            upload_count         = upload_count,
        )
        result.append(summary)
    return result


@router.put("/admin/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "משתמש לא נמצא")
    user.is_active = not user.is_active
    db.commit()
    return {"is_active": user.is_active}
