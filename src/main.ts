import {NextFunction, Request, Response} from "express";
import {Client} from "./auth-client/client";
import {newLogger} from "./logger";


const express = require('express');
const app = express();

const cors = require('cors');
const corsOptions = {
    origin: function (origin: string, callback: any) {
        callback(null, !origin || corsOrigins.indexOf(origin) > -1);
    }
};
app.use(cors(corsOptions));
app.use(express.json({
    limit: "6mb",
    inflate: true,
    strict: true,
    type: "application/json"
}))


const bodyParser = require('body-parser');

// import fleekStorage from '@fleekhq/fleek-storage-js'
const AWS = require('aws-sdk')
//const methodOverride = require('method-override')
const packageJson = require("../package.json");

const logger = newLogger("file-server", undefined);


if (!process.env.CORS_ORIGNS) {
    throw new Error("No CORS_ORIGNS env variable");
}
const corsOrigins = process.env.CORS_ORIGNS.split(";").map(o => o.trim());
logger.log("Cors origins: ", corsOrigins);

/*
app.use( bodyParser.json({limit: '5mb'}) );
app.use(bodyParser.urlencoded({
    limit: '5mb',
    extended: true,
    parameterLimit:5000
}));
app.use(methodOverride())
app.use(function (a:any, b:any, c:any) {
    // logic
    logger.log("An error occured:", err);
});
 */

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

app.post('/upload', async (req: Request, res: Response, next:NextFunction) => {
    const uploadLogger = logger.newLogger("upload");
    try {
        let sub: string = "";
        if (!req.headers.authorization) {
            throw new Error(`Not authorized.`);
        }

        if (!process.env.APP_ID) {
            throw new Error('process.env.APP_ID is not set')
        }
        if (!process.env.ACCEPTED_ISSUER) {
            throw new Error('process.env.ACCEPTED_ISSUER is not set')
        }

        uploadLogger.log(`Trying to verify the client's authorization ..`);

        const authClient = new Client(process.env.APP_ID, process.env.ACCEPTED_ISSUER);
        const tokenPayload = await authClient.verify(req.headers.authorization);
        if (!tokenPayload) {
            throw new Error("Couldn't decode or verify the supplied JWT.")
        }

        sub = tokenPayload.sub;
        uploadLogger.log(`Trying to verify the client's authorization .. Success. Sub: ${sub}`);

        const fileName = req.body.fileName;
        const mimeType = req.body.mimeType;
        const bytes = Buffer.from(req.body.bytes, 'base64');

        const spacesEndpoint = new AWS.Endpoint(process.env.DIGITALOCEAN_SPACES_ENDPOINT);
        const s3 = new AWS.S3({
            endpoint: spacesEndpoint,
            accessKeyId: process.env.DIGITALOCEAN_SPACES_KEY,
            secretAccessKey: process.env.DIGITALOCEAN_SPACES_SECRET
        });

        const dir = sub.replace("/", "--");
        const params:{
            Bucket: string,
            Body?: any,
            Key: string,
            ACL: string
        } = {
            Bucket: "circlesland-pictures",
            Key: `${dir}/${fileName ?? "no-name"}`,
            ACL: 'public-read'
        };

        uploadLogger.log(`Uploading ..`, params);

        params.Body = bytes;
        await s3.putObject(params).promise();

        uploadLogger.log(`Uploading .. Success.`, {
            ...params,
            url: `https://circlesland-pictures.fra1.cdn.digitaloceanspaces.com/${params.Key}`
        });

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
        uploadLogger.log(e.message);
        uploadLogger.log(e.stackTrace);

        return res.json({
            status: "error",
            message: e.message
        });
    }
});

if (!process.env.PORT) {
    throw new Error('process.env.PORT is not set')
}

app.listen(process.env.PORT, () => {
    console.log(`Server is running at http://localhost:${process.env.PORT}`);
});