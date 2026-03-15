export type ShelbyBlobWriteRequest = {
  accountAddress: string;
  blobName: string;
  contentType: string;
  data: Uint8Array;
};

export type ShelbyBlobWriteResponse = {
  blobKey: string;
  readUrl: string;
  sizeBytes: number;
};
