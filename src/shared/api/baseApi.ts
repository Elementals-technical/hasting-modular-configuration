// Mock RTK Query api shape to keep store wiring intact.
export const baseApi = {
  reducerPath: "api",
  reducer: (state = {}) => state,
  middleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action),
};
