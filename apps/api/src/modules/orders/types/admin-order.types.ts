export enum AdminOrderTab {
  ACTIVE = 'ACTIVE',
  SCHEDULED = 'SCHEDULED',
  ALL = 'ALL',
}

export interface AdminOrderCounts {
  active: number;
  scheduled: number;
  all: number;
}
