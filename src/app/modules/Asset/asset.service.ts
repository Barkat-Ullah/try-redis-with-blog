import httpStatus from 'http-status';
import {
    deleteFile,
    deleteFiles,
    uploadFiles,
    uploadSingleFile,
    updateSingleFile,
    updateFiles,
} from '../../utils/uploadFiles';
import AppError from '../../errors/AppError';

const uploadAsset = async (file: Express.Multer.File | undefined) => {
    if (!file) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
    }
    const location = uploadSingleFile(file);
    return location;
};

const uploadMultipleAssets = async (files: Express.Multer.File[] | undefined) => {
    if (!files || files.length === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide at least one asset');
    }
    console.log(files)
    const locations = uploadFiles(files);
    return locations;
};

const deleteAsset = async (path: string) => {
    const success = deleteFile(path);
    return success;
};

const deleteMultipleAssets = async (paths: string[]) => {
    const deleted = deleteFiles(paths);
    return deleted;
};

const updateAsset = async (
    oldPath: string,
    newFile: Express.Multer.File | undefined
) => {
    if (!newFile) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide a new file to update the asset');
    }
    const newLocation = updateSingleFile(oldPath, newFile);
    return newLocation;
};

const updateMultipleAsset = async (
    oldPaths: string[],
    newFiles: Express.Multer.File[] | undefined
) => {
    if (!newFiles || newFiles.length === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Provide new files to update the assets');
    }
    const newLocations = updateFiles(oldPaths, newFiles);
    return newLocations;
};

export const AssetService = {
    upload: uploadAsset,
    uploadMultiple: uploadMultipleAssets,
    delete: deleteAsset,
    deleteMultiple: deleteMultipleAssets,
    update: updateAsset,
    updateMultipleAsset,
};
