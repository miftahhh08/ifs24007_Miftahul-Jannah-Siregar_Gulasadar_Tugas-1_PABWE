// Error yang aman ditampilkan ke pengguna (pesan jelas, status HTTP tepat).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
