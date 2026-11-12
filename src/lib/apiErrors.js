// The provider refused the key itself. Other batches or syntax groups would be
// refused the same way, so a run stops instead of trying them.
export class ApiKeyError extends Error {}
