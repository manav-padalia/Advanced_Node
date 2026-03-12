import { ResponseCodes } from '../constants/ResponseCodes';

/**
 * Standard API response structure enforced across all services
 */
export interface ApiResponse<T = any> {
  status: ResponseCodes;
  message: string;
  data: T;
  error: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMeta {
  cursor: string | null;
  limit: number;
  hasNext: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Cursor paginated response wrapper
 */
export interface CursorPaginatedResponse<T> {
  items: T[];
  meta: CursorPaginationMeta;
}
