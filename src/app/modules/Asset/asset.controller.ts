import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AssetService } from './asset.service';

const uploadAsset = catchAsync(async (req, res) => {
    const file = req.file;
    const url = await AssetService.upload(file);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'File uploaded successfully',
        data: { url },
    });
});

const uploadMultipleAssets = catchAsync(async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const urls = await AssetService.uploadMultiple(files);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Files uploaded successfully',
        data: { urls },
    });
});

const deleteAsset = catchAsync(async (req, res) => {
    const { path } = req.body;
    const success = await AssetService.delete(path);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'File deleted successfully',
        data: success
    });
});

const deleteMultipleAssets = catchAsync(async (req, res) => {
    const { paths } = req.body;
    const deleted = await AssetService.deleteMultiple(paths);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Files deleted successfully',
        data: { deleted },
    });
});

const updateAsset = catchAsync(async (req, res) => {
    const { oldPath } = req.body;
    const file = req.file;
    const newUrl = await AssetService.update(oldPath, file);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'File updated successfully',
        data: { url: newUrl },
    });
});

const updateMultipleAssets = catchAsync(async (req, res) => {
    const { oldPaths } = req.body;
    const files = req.files as Express.Multer.File[];
    const { saved: urls } = await AssetService.updateMultipleAsset(oldPaths, files);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Files updated successfully',
        data: { urls },
    });
});

export const AssetController = {
    uploadAsset,
    uploadMultipleAssets,
    deleteAsset,
    deleteMultipleAssets,
    updateAsset,
    updateMultipleAssets,
};
