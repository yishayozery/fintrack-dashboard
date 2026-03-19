from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50),  unique=True, nullable=False, index=True)
    email           = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active       = Column(Boolean, default=True)
    is_admin        = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow)
    last_login      = Column(DateTime, nullable=True)

    # ── Profile fields ─────────────────────────────────────
    full_name            = Column(String(100), nullable=True)
    phone                = Column(String(20),  nullable=True)
    city                 = Column(String(60),  nullable=True)
    # single | married | divorced | widowed | separated
    family_status        = Column(String(20),  nullable=True)
    num_children         = Column(Integer,     default=0)
    # employed | self-employed | business-owner | retired | student | other
    employment_type      = Column(String(40),  nullable=True)
    # <10k | 10-20k | 20-30k | 30-50k | 50k+
    monthly_income_range = Column(String(20),  nullable=True)
    # primary residence type
    housing_type         = Column(String(30),  nullable=True)  # owned | rented | parents | other

    # ── Dashboard state (stored per-user) ──────────────────
    data_folder_path   = Column(String(500), nullable=True)
    cat_overrides      = Column(JSON, default=dict)   # {txId: category}
    tx_project_map     = Column(JSON, default=dict)   # {txId: projectId}
    projects           = Column(JSON, default=list)   # [{id, name, icon, color}]
    ins_renewal_dates  = Column(JSON, default=dict)   # {providerName: dateStr}
    dismissed_issues   = Column(JSON, default=list)   # [issueKey, ...]
    dispute_items      = Column(JSON, default=list)   # [{...}]

    # ── Relations ──────────────────────────────────────────
    uploads = relationship("UploadedFile", back_populates="user", cascade="all, delete")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename    = Column(String(255), nullable=False)
    file_type   = Column(String(20),  nullable=False)   # bank | credit_card | credit_detail
    card_last4  = Column(String(10),  nullable=True)
    month       = Column(String(20),  nullable=True)    # "ינואר 2026"
    uploaded_at = Column(DateTime,    default=datetime.utcnow)
    status      = Column(String(20),  default="pending")  # pending | processed | error
    error_msg   = Column(Text,        nullable=True)

    user = relationship("User", back_populates="uploads")


class AdminNote(Base):
    """Notes that admin can attach to users"""
    __tablename__ = "admin_notes"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    note       = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
