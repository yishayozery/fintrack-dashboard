from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# ── Auth ────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username:             str
    email:                EmailStr
    password:             str
    full_name:            Optional[str]   = None
    phone:                Optional[str]   = None
    city:                 Optional[str]   = None
    family_status:        Optional[str]   = None   # single|married|divorced|widowed
    num_children:         Optional[int]   = 0
    employment_type:      Optional[str]   = None
    monthly_income_range: Optional[str]   = None
    housing_type:         Optional[str]   = None

    @validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("סיסמה חייבת להכיל לפחות 8 תווים")
        return v

    @validator("username")
    def username_valid(cls, v):
        if len(v) < 3:
            raise ValueError("שם משתמש חייב להכיל לפחות 3 תווים")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("שם משתמש יכול להכיל רק אותיות, ספרות, _ ו-")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    username:     str
    is_admin:     bool


# ── User ────────────────────────────────────────────────────────────
class UserProfile(BaseModel):
    id:                   int
    username:             str
    email:                str
    full_name:            Optional[str]
    phone:                Optional[str]
    city:                 Optional[str]
    family_status:        Optional[str]
    num_children:         int
    employment_type:      Optional[str]
    monthly_income_range: Optional[str]
    housing_type:         Optional[str]
    is_admin:             bool
    created_at:           datetime
    last_login:           Optional[datetime]
    data_folder_path:     Optional[str]

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name:            Optional[str]
    phone:                Optional[str]
    city:                 Optional[str]
    family_status:        Optional[str]
    num_children:         Optional[int]
    employment_type:      Optional[str]
    monthly_income_range: Optional[str]
    housing_type:         Optional[str]
    data_folder_path:     Optional[str]


# ── Dashboard state sync ─────────────────────────────────────────────
class DashboardStateRequest(BaseModel):
    cat_overrides:     Optional[Dict[str, str]]   = None
    tx_project_map:    Optional[Dict[str, int]]   = None
    projects:          Optional[List[Dict]]       = None
    ins_renewal_dates: Optional[Dict[str, str]]   = None
    dismissed_issues:  Optional[List[str]]        = None
    dispute_items:     Optional[List[Dict]]       = None


class DashboardStateResponse(BaseModel):
    cat_overrides:     Dict
    tx_project_map:    Dict
    projects:          List
    ins_renewal_dates: Dict
    dismissed_issues:  List
    dispute_items:     List


# ── File uploads ────────────────────────────────────────────────────
class UploadedFileOut(BaseModel):
    id:          int
    filename:    str
    file_type:   str
    card_last4:  Optional[str]
    month:       Optional[str]
    uploaded_at: datetime
    status:      str
    error_msg:   Optional[str]

    class Config:
        from_attributes = True


# ── Admin ────────────────────────────────────────────────────────────
class AdminUserSummary(BaseModel):
    id:                   int
    username:             str
    email:                str
    full_name:            Optional[str]
    city:                 Optional[str]
    family_status:        Optional[str]
    num_children:         int
    employment_type:      Optional[str]
    monthly_income_range: Optional[str]
    is_active:            bool
    is_admin:             bool
    created_at:           datetime
    last_login:           Optional[datetime]
    upload_count:         int = 0

    class Config:
        from_attributes = True
