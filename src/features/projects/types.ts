export type ProjectQueryResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type CreateProjectState = {
  fieldError?: string;
  message?: string;
};