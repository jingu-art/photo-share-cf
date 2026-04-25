export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  fileCount: number;
  totalUploaded: number;
}

export interface Photo {
  key: string;
  name: string;
  thumbKey: string;
  url: string;
  thumbUrl: string;
  size: number;
}

export interface UploadItem {
  filename: string;
  key: string;
  thumbKey: string;
  uploadUrl: string;
  thumbUploadUrl: string;
}
