from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
import models, schemas
from auth import verify_password, hash_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    # Check username / email uniqueness
    if db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(400, "שם משתמש כבר תפוס")
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "כתובת אימייל כבר רשומה")

    user = models.User(
        username             = req.username,
        email                = req.email,
        hashed_password      = hash_password(req.password),
        full_name            = req.full_name,
        phone                = req.phone,
        city                 = req.city,
        family_status        = req.family_status,
        num_children         = req.num_children or 0,
        employment_type      = req.employment_type,
        monthly_income_range = req.monthly_income_range,
        housing_type         = req.housing_type,
        last_login           = datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.username)
    return schemas.TokenResponse(
        access_token = token,
        user_id      = user.id,
        username     = user.username,
        is_admin     = user.is_admin,
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "שם משתמש או סיסמה שגויים")
    if not user.is_active:
        raise HTTPException(403, "החשבון מושהה. פנה למנהל מערכת.")

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(user.id, user.username)
    return schemas.TokenResponse(
        access_token = token,
        user_id      = user.id,
        username     = user.username,
        is_admin     = user.is_admin,
    )
