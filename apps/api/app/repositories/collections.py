"""Single source of truth for collection names. Kept in sync with the JS client."""

from __future__ import annotations

from typing import Final

USERS: Final = "users"
STUDIOS: Final = "studios"
SLUGS: Final = "slugs"
GALLERIES: Final = "galleries"
ALBUMS: Final = "albums"
PHOTOS: Final = "photos"

# Face-clustering collections.
#
# - faceClusters/{clusterId}   one doc per visual person in a gallery
# - photoFaces/{photoId}       per-photo summary of detected faces + cluster
#                              assignments (1:1 with /photos)
FACE_CLUSTERS: Final = "faceClusters"
PHOTO_FACES: Final = "photoFaces"
