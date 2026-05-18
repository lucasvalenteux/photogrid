import { FIRESTORE_COLLECTIONS } from '@photogrid/config';
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';

import type {
  AlbumDoc,
  ClientDoc,
  FaceClusterDoc,
  GalleryDoc,
  OrderDoc,
  PhotoDoc,
  SlugReservation,
  StudioDoc,
  UserDoc,
} from '@/types';

import { db } from './client';

const typedCollection = <T extends DocumentData>(name: string) =>
  collection(db, name) as CollectionReference<T>;

const typedDoc = <T extends DocumentData>(name: string, id: string) =>
  doc(db, name, id) as DocumentReference<T>;

export const usersCollection = () => typedCollection<UserDoc>(FIRESTORE_COLLECTIONS.users);
export const studiosCollection = () => typedCollection<StudioDoc>(FIRESTORE_COLLECTIONS.studios);
export const slugsCollection = () => typedCollection<SlugReservation>(FIRESTORE_COLLECTIONS.slugs);
export const galleriesCollection = () =>
  typedCollection<GalleryDoc>(FIRESTORE_COLLECTIONS.galleries);
export const albumsCollection = () => typedCollection<AlbumDoc>(FIRESTORE_COLLECTIONS.albums);
export const photosCollection = () => typedCollection<PhotoDoc>(FIRESTORE_COLLECTIONS.photos);
export const faceClustersCollection = () =>
  typedCollection<FaceClusterDoc>(FIRESTORE_COLLECTIONS.faceClusters);
export const photoFacesCollection = () =>
  typedCollection<DocumentData>(FIRESTORE_COLLECTIONS.photoFaces);
export const ordersCollection = () =>
  typedCollection<OrderDoc>(FIRESTORE_COLLECTIONS.orders);
export const clientsCollection = () =>
  typedCollection<ClientDoc>(FIRESTORE_COLLECTIONS.clients);

export const userDoc = (id: string) => typedDoc<UserDoc>(FIRESTORE_COLLECTIONS.users, id);
export const studioDoc = (id: string) => typedDoc<StudioDoc>(FIRESTORE_COLLECTIONS.studios, id);
export const slugDoc = (slug: string) =>
  typedDoc<SlugReservation>(FIRESTORE_COLLECTIONS.slugs, slug);
export const galleryDoc = (id: string) =>
  typedDoc<GalleryDoc>(FIRESTORE_COLLECTIONS.galleries, id);
export const albumDoc = (id: string) => typedDoc<AlbumDoc>(FIRESTORE_COLLECTIONS.albums, id);
export const photoDoc = (id: string) => typedDoc<PhotoDoc>(FIRESTORE_COLLECTIONS.photos, id);
export const faceClusterDoc = (id: string) =>
  typedDoc<FaceClusterDoc>(FIRESTORE_COLLECTIONS.faceClusters, id);
export const photoFaceDoc = (id: string) =>
  typedDoc<DocumentData>(FIRESTORE_COLLECTIONS.photoFaces, id);
export const orderDoc = (id: string) => typedDoc<OrderDoc>(FIRESTORE_COLLECTIONS.orders, id);
export const clientDoc = (id: string) => typedDoc<ClientDoc>(FIRESTORE_COLLECTIONS.clients, id);
