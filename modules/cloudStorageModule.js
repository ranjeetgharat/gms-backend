const { Storage } = require('@google-cloud/storage');
const path = require('path');

const UploadFile = async (filePath, destFileName) => {
    const gcs = new Storage({
        keyFilename: path.join(__dirname, '../oauth2.keys.json'),
    });
    const bucket = gcs.bucket(process.env.GCP_STORAGE_BUCKET);

    /*await bucket.setCorsConfiguration([{
        origin: ['http://localhost:3000/'],
        responseHeader: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Headers', 'Origin', 'Content-Type', 'Accept', 'Access-Control-Request-Headers'],
    }]);*/

    const options = {
        destination: destFileName,
        preconditionOpts: { ifGenerationMatch: 0 },
    };
    const [, resp] = await bucket.upload(filePath, options);
    return resp;
};

const DeleteFile = async (filePath) => {
    const gcs = new Storage({
        keyFilename: path.join(__dirname, '../oauth2.keys.json'),
    });
    const bucket = gcs.bucket(process.env.GCP_STORAGE_BUCKET);
    const options = {
        preconditionOpts: { ifGenerationMatch: 0 },
    };
    await bucket.file(filePath).delete(options);
};

const CopyFile = async (filePath, destFileName) => {
    const gcs = new Storage({
        keyFilename: path.join(__dirname, '../oauth2.keys.json'),
    });
    const bucket = gcs.bucket(process.env.GCP_STORAGE_BUCKET);

    const copyDestination = bucket.file(destFileName);
    const copyOptions = {
        preconditionOpts: { ifGenerationMatch: 0, },
    };
    const [, resp] = await bucket.file(filePath).copy(copyDestination, copyOptions);
    return resp.resource;
};

const MoveFile = async (filePath, destFileName) => {
    const gcs = new Storage({
        keyFilename: path.join(__dirname, '../oauth2.keys.json'),
    });
    const bucket = gcs.bucket(process.env.GCP_STORAGE_BUCKET);
    const options = {
        preconditionOpts: { ifGenerationMatch: 0 },
    };
    const [, resp] = await bucket.file(filePath).move(destFileName, options);
    return resp.resource;
};

const GenerateSignedUrl = async (gcp_file_path) => {
    const gcs = new Storage({
        keyFilename: path.join(__dirname, '../oauth2.keys.json'),
    });
    const bucket = gcs.bucket(process.env.GCP_STORAGE_BUCKET);
    const options = {
        version: 'v2', // defaults to 'v2' if missing.
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60, // one hour
    };
    const [url] = await bucket.file(gcp_file_path).getSignedUrl(options);
    return url;
};

module.exports = {
    UploadFile,
    DeleteFile,
    CopyFile,
    MoveFile,
    GenerateSignedUrl,
};