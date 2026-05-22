"""Pure domain models. No Firestore dependencies live here."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class _Base(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)


class User(_Base):
    id: str
    email: EmailStr
    studio_id: str | None = Field(default=None, alias="studioId")
    created_at: datetime = Field(alias="createdAt")


class Studio(_Base):
    id: str
    owner_id: str = Field(alias="ownerId")
    name: str
    slug: str
    created_at: datetime = Field(alias="createdAt")


class Gallery(_Base):
    id: str
    studio_id: str = Field(alias="studioId")
    title: str
    description: str | None = None
    cover_photo_url: str | None = Field(default=None, alias="coverPhotoUrl")
    photo_count: int = Field(default=0, alias="photoCount")
    album_count: int = Field(default=0, alias="albumCount")
    visibility: str | None = None
    created_at: datetime = Field(alias="createdAt")


class Album(_Base):
    id: str
    studio_id: str = Field(alias="studioId")
    gallery_id: str = Field(alias="galleryId")
    title: str
    subject_name: str | None = Field(default=None, alias="subjectName")
    cover_photo_url: str | None = Field(default=None, alias="coverPhotoUrl")
    photo_ids: list[str] = Field(default_factory=list, alias="photoIds")
    created_at: datetime = Field(alias="createdAt")


class Photo(_Base):
    id: str
    studio_id: str = Field(alias="studioId")
    gallery_id: str = Field(alias="galleryId")
    image_url: str = Field(alias="imageUrl")
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
    storage_path: str = Field(alias="storagePath")
    thumbnail_path: str | None = Field(default=None, alias="thumbnailPath")
    width: int | None = None
    height: int | None = None
    bytes: int | None = None
    content_type: str | None = Field(default=None, alias="contentType")
    file_name: str = Field(alias="fileName")
    created_at: datetime = Field(alias="createdAt")


# ---------------------------------------------------------------------------
# Face clustering domain
# ---------------------------------------------------------------------------


class DetectedFace(_Base):
    """A single face detection result inside a photo."""

    # Bounding box in absolute pixels of the input image (x1, y1, x2, y2).
    bbox: list[float]
    # Detection confidence, 0..1.
    score: float
    # L2-normalised ArcFace embedding (512 floats). Optional during writes
    # where we want to record a detection but skip recognition.
    embedding: list[float] | None = None
    # Cluster this face was assigned to (set after clustering).
    cluster_id: str | None = Field(default=None, alias="clusterId")


class PhotoFaces(_Base):
    """Per-photo summary of detection results. Stored at /photoFaces/{photoId}."""

    photo_id: str = Field(alias="photoId")
    gallery_id: str = Field(alias="galleryId")
    studio_id: str = Field(alias="studioId")
    faces: list[DetectedFace] = Field(default_factory=list)
    # Last time clustering ran against this photo. Used to skip re-processing.
    processed_at: datetime = Field(alias="processedAt")


class FaceCluster(_Base):
    """A visual person inside a gallery, with running centroid + members.

    Stored at /faceClusters/{clusterId}. The centroid is the mean of all
    member embeddings (l2-normalised after each addition) — fine for tens
    of thousands of photos before we need a more sophisticated index.
    """

    id: str
    gallery_id: str = Field(alias="galleryId")
    studio_id: str = Field(alias="studioId")
    centroid: list[float]
    photo_count: int = Field(default=0, alias="photoCount")
    # Photo ids that contain at least one face assigned to this cluster.
    photo_ids: list[str] = Field(default_factory=list, alias="photoIds")
    # Best representative face — picked as the highest-scoring detection
    # ever assigned to the cluster. We snapshot the source photo's URL +
    # the face bounding box so the UI can render a face crop without an
    # extra round-trip.
    representative_photo_id: str | None = Field(default=None, alias="representativePhotoId")
    representative_photo_url: str | None = Field(
        default=None, alias="representativePhotoUrl"
    )
    representative_thumbnail_url: str | None = Field(
        default=None, alias="representativeThumbnailUrl"
    )
    representative_bbox: list[float] | None = Field(default=None, alias="representativeBbox")
    representative_score: float = Field(default=0.0, alias="representativeScore")
    # Open clusters appear as album suggestions. Once the user promotes a
    # cluster into an album we set status=promoted + albumId so the UI can
    # hide it (or render a "ver álbum" link instead).
    status: str = Field(default="open")  # "open" | "promoted" | "dismissed"
    album_id: str | None = Field(default=None, alias="albumId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
