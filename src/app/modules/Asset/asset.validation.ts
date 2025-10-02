import { z } from 'zod';

const updateAssetSchema = z.object({
    body: z.object({
        oldPath: z.string(),
    })
});

const deleteAssetSchema = z.object({
    body: z.object({
        path: z.string(),
    })
});

const updateMultipleAssetsSchema = z.object({
    body: z.object({
        oldPaths: z.array(z.string().min(1)),
    })
});
const deleteMultipleAssetsSchema = z.object({
   body: z.object({
        paths: z.array(z.string().min(1)),
    })
});

export const AssetValidation = {
    updateAssetSchema, deleteAssetSchema, updateMultipleAssetsSchema,
    deleteMultipleAssetsSchema
}
