export interface NationalParkSummary {
  total: number;
  withPrimaryImage: number;
  withLocalImages: number;
  sources: NationalParkSourceSummary[];
}

export interface NationalParkSourceSummary {
  source: string;
  total: number;
}

export interface NationalParkListItem {
  parkId: string;
  source: string | null;
  slug: string | null;
  mapUrl: string | null;
  title: string | null;
  mapPopupTitle: string | null;
  mapPopupExcerpt: string | null;
  thumbnailUrl: string | null;
  primaryImageUrl: string | null;
  primaryImagePath: string | null;
  imageCount: number;
  mapLatitude: number | null;
  mapLongitude: number | null;
  coordinateText: string | null;
  areaText: string | null;
  managementAgency: string | null;
  detailUrl: string | null;
}

export interface NationalParkDetail extends NationalParkListItem {
  mapUrl: string | null;
  author: string | null;
  summaryText: string | null;
  establishmentDecision: string | null;
  objectiveMission: string | null;
  parentAgency: string | null;
  managementBoard: string | null;
  geographicLocation: string | null;
  biodiversity: string | null;
  flora: string | null;
  fauna: string | null;
  tourismActivities: string | null;
  relatedProjects: string | null;
  populationInArea: string | null;
  references: string | null;
  detailSections: unknown;
  contentText: string | null;
  imageUrls: string[];
  imageCaptions: string[];
  localImagePaths: string[];
  imageMetadata: unknown;
  sourcePayload: unknown;
}

export interface NationalParkImageMetadata {
  imageId?: string;
  imageGroupId?: string;
  imageOrder?: number | string;
  image_order?: number | string;
  isPrimary?: boolean | string;
  sourceImageUrl?: string;
  source_image_url?: string;
  imageUrl?: string;
  image_url?: string;
  localPath?: string;
  local_path?: string;
  caption?: string;
  width?: number | string;
  height?: number | string;
  mimeType?: string;
  mime_type?: string;
}

export interface NationalParkListResponse {
  items: NationalParkListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  query: string;
  filters: {
    source: string;
    hasImage: string;
  };
}

export interface NationalParkMapLayer {
  items: NationalParkListItem[];
  total: number;
}
