export type ISODateString = string & {
  readonly __brand: 'ISODateString';
};

export interface DateRange {
  readonly from: ISODateString;
  readonly to: ISODateString;
}

export interface AuditMetadata {
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

export interface SoftDeletable {
  readonly deletedAt?: ISODateString;
  readonly deletedBy?: string;
}

export type SortOrder = 'asc' | 'desc';