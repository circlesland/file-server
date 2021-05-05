import {Request, Response} from "express";
import {Client} from "./auth-client/client";

const cors = require('cors')
const express = require('express');
const bodyParser = require('body-parser');
// import fleekStorage from '@fleekhq/fleek-storage-js'
const AWS = require('aws-sdk')

const packageJson = require("../package.json");

const app = express();

if (!process.env.CORS_ORIGNS) {
    throw new Error("No CORS_ORIGNS env variable");
}
const corsOrigins = process.env.CORS_ORIGNS.split(";").map(o => o.trim());
console.log("Cors origins: ", corsOrigins);

const corsOptions = {
    origin: function (origin: string, callback: any) {
        callback(null, !origin || corsOrigins.indexOf(origin) > -1);
    }
}

app.use(cors(corsOptions));
app.use(bodyParser.json({limit: '5mb', type: 'application/json'}));

app.get('/', (req: Request, res: Response) => {
    res.statusCode = 200;
    const version = packageJson.version.split(".");
    return res.json({
        status: "ok",
        version: {
            major: version[0],
            minor: version[1],
            revision: version[2]
        }
    });
});

app.post('/upload', async (req: Request, res: Response) => {
    let sub: string = "";
    try {
        if (!req.headers.authorization) {
            throw new Error(`Not authorized.`);
        }

        if (!process.env.APP_ID) {
            throw new Error('process.env.APP_ID is not set')
        }
        if (!process.env.ACCEPTED_ISSUER) {
            throw new Error('process.env.ACCEPTED_ISSUER is not set')
        }

        const authClient = new Client(process.env.APP_ID, process.env.ACCEPTED_ISSUER);
        const tokenPayload = await authClient.verify(req.headers.authorization);
        if (!tokenPayload) {
            throw new Error("Couldn't decode or verify the supplied JWT.")
        }

        sub = tokenPayload.sub;
    } catch (e) {
        console.error(e);
        return res.json({
            status: "error",
            message: e.message
        });
    }

    const fileName = req.body.fileName;
    const mimeType = req.body.mimeType;
    const bytes = Buffer.from(req.body.bytes, 'base64');

    if (!process.env.FLEEK_STORAGE_API_KEY) {
        throw new Error('process.env.FLEEK_STORAGE_API_KEY is not set')
    }
    if (!process.env.FLEEK_STORAGE_API_SECRET) {
        throw new Error('process.env.FLEEK_STORAGE_API_SECRET is not set')
    }

    try {
        /*
        const uploadedFile = await fleekStorage.upload({
            apiKey: process.env.FLEEK_STORAGE_API_KEY,
            apiSecret: process.env.FLEEK_STORAGE_API_SECRET,
            key: `${sub}/${fileName ?? "no-name"}`,
            data: bytes
        });
         */

        const spacesEndpoint = new AWS.Endpoint(process.env.DIGITALOCEAN_SPACES_ENDPOINT);
        const s3 = new AWS.S3({
            endpoint: spacesEndpoint,
            accessKeyId: process.env.DIGITALOCEAN_SPACES_KEY,
            secretAccessKey: process.env.DIGITALOCEAN_SPACES_SECRET
        });

        var params = {
            Bucket: "circlesland-pictures",
            Body: bytes,
            Key: `${sub}/${fileName ?? "no-name"}`,
            ACL:'public-read'
        };

        await s3.putObject(params).promise();

        res.statusCode = 200;
        return res.json({
            status: "ok",
            hash: "",//uploadedFile.hash,
            hashV8: "",//uploadedFile.hashV0,
            bucket: "",//uploadedFile.bucket,
            url: `https://circlesland-pictures.fra1.cdn.digitaloceanspaces.com/${params.Key}`,
            key: params.Key
        });
    } catch (e) {
        console.error(e);
        return res.json({
            status: "error",
            message: "An error occurred during the file upload."
        })
    }
});

if (!process.env.PORT) {
    throw new Error('process.env.PORT is not set')
}

app.listen(process.env.PORT, () => {
    console.log(`Server is running at http://localhost:${process.env.PORT}`);
});

async function uploadtoS3 () {

    const spacesEndpoint = new AWS.Endpoint(process.env.DIGITALOCEAN_SPACES_ENDPOINT);
    const s3 = new AWS.S3({
        endpoint: spacesEndpoint,
        accessKeyId: process.env.DIGITALOCEAN_SPACES_KEY,
        secretAccessKey: process.env.DIGITALOCEAN_SPACES_SECRET
    });

// Add a file to a Space
    var params = {
        Bucket: "circlesland-pictures",
        Body: "Hello",
        Key: `abc/dasds.txt`,
        ACL:'public-read'
    };
    const request = await s3.putObject(params).promise();
    console.log(request);
}

uploadtoS3();

