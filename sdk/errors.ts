export class AddonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonError';
  }
}
