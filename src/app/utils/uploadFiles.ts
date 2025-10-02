import fs from 'fs';
import path from 'path';
import config from '../../config';

const baseUploadDir = path.join(__dirname, '..', 'upload');
const nodeEnv = config.env as 'development' | 'production';

const getSubFolder = (mimetype: string): string => {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype === 'application/pdf') return 'pdfs';
  if (
    mimetype === 'application/msword' ||
    mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'docs';
  return 'others';
};

const normalizePath = (filePath: string) => filePath.replace(/\\/g, '/');

const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const deleteFile = (relPath: string): boolean => {
  const filePath = path.join(__dirname, '..', relPath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

export const uploadSingleFile = (file: Express.Multer.File) => {
  const subFolder = getSubFolder(file.mimetype);
  const folderPath = path.join(baseUploadDir, subFolder);
  const filename =
    Date.now() +
    '-' +
    Math.round(Math.random() * 1e9) +
    path.extname(file.originalname);

  ensureDirectoryExists(folderPath);

  const filePath = path.join(folderPath, filename);
  fs.writeFileSync(filePath, file.buffer);

  const relPath = path.join('upload', subFolder, filename);
  return {
    name: file.originalname,
    url: `/${normalizePath(relPath)}`,
  };
};

export const uploadFiles = (files: Express.Multer.File[]) => {
  const keptFiles: {
    name: string;
    url: string;
  }[] = [];

  for (const file of files) {
    const url = uploadSingleFile(file);
    keptFiles.push(url);
  }

  return keptFiles;
};

export const deleteFiles = (filePaths: string[]): string[] => {
  return filePaths.filter(relPath => deleteFile(relPath));
};

export const updateSingleFile = (
  oldFilePath: string,
  newFile: Express.Multer.File,
) => {
  deleteFile(oldFilePath);
  return uploadSingleFile(newFile);
};

export const updateFiles = (
  oldPaths: string[],
  newFiles: Express.Multer.File[],
): {
  deleted: string[];
  saved: {
    name: string;
    url: string;
  }[];
} => {
  const deleted = deleteFiles(oldPaths);
  const saved = uploadFiles(newFiles);
  return { deleted, saved };
};
